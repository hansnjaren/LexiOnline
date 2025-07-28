// src/rooms/MyRoom.ts
import { Room, Client } from "@colyseus/core";
import { ArraySchema } from "@colyseus/schema";
import { MyRoomState } from "./schema/MyRoomState";
import { PlayerState } from "./schema/PlayerState";
import { createShuffledDeck } from "../gameLogic/createShuffledDeck";
import { dealCards } from "../gameLogic/dealCards";
import { findPlayerWithCloud3 } from "../gameLogic/findPlayerWithCloud3";
import { calculateRoundScores, calculateRoundScoreMatrix } from "../gameLogic/scoreCalculator";
import { MADE_NONE } from "../gameLogic/cardEvaluator";
import {
  handleSubmit,
  handlePass,
  handleReady,
  handleEasyMode,
  IMyRoom,
} from "../roomLogic/messageHandlers";

export class MyRoom extends Room<MyRoomState> implements IMyRoom {
  maxClients = 5;
  state = new MyRoomState();
  
  autoDispose = false;

  maxNumberMap: Record<number, number> = { 3: 9, 4: 13, 5: 15 };

  onCreate(options: any) {
    this.onMessage("changeRounds", (client, data) => {
      if (client.sessionId !== this.state.host) {
        client.send("changeRejected", { reason: "Only the host can change rounds." });
        return;
      }
      const newRounds = data.rounds;
      if (typeof newRounds === "number" && newRounds > 0) {
        this.state.totalRounds = newRounds;
      } else {
        client.send("changeRejected", { reason: "Invalid round count." });
      }
    });

    this.onMessage("submit", (client, data) => handleSubmit(this, client, data));
    this.onMessage("pass", (client) => handlePass(this, client));
    this.onMessage("ready", (client, data) => handleReady(this, client, data));
    this.onMessage("easyMode", (client, data) => handleEasyMode(this, client, data));
    
    this.onMessage("setNickname", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !data.nickname) {
        client.send("nicknameRejected", { reason: "Invalid player or nickname" });
        return;
      }
      const nickname = data.nickname.trim();
      if (nickname.length === 0) {
        client.send("nicknameRejected", { reason: "Nickname cannot be empty" });
        return;
      }
      const existingPlayer = Array.from(this.state.players.values()).find(p => 
        p.nickname === nickname && p.sessionId !== client.sessionId
      );
      if (existingPlayer) {
        client.send("nicknameRejected", { 
          reason: "Nickname already exists in this room",
          existingNickname: nickname
        });
        return;
      }
      player.nickname = nickname;
      this.broadcast("nicknameUpdate", {
        playerId: client.sessionId,
        nickname: nickname
      });
    });

    this.onMessage("checkNickname", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.nickname && player.nickname !== '') {
        client.send("nicknameConfirmed", { nickname: player.nickname });
      }
    });

    this.onMessage("playAgain", (client) => {
      this.resetGameState();
      this.broadcast("gameReset", {});
    });

    this.onMessage("start", (client, data) => {
      if (client.sessionId !== this.state.host) {
        client.send("startRejected", { reason: "Only the host can start the game." });
        return;
      }
      if (this.state.players.size < 3) {
        client.send("startRejected", { reason: "Not enough players." });
        return;
      }
      for(const [sessionId, player] of this.state.players){
        if(!player.ready){
          client.send("startRejected", { reason: "There exists some players who are not ready. " });
        }
      }
      this.startGame();
      this.startRound();
      this.broadcast("gameStarted", { totalRounds: this.state.totalRounds, easyMode: this.state.easyMode });
    });
  }

  onJoin(client: Client, options: { guestId?: string }) {
    if (options.guestId) {
      const existingPlayer = Array.from(this.state.players.values()).find(p => p.guestId === options.guestId);
      
      if (existingPlayer) {
        console.log(`[MyRoom] Player ${existingPlayer.nickname} rejoining with new session ${client.sessionId}`);
        
        const oldSessionId = existingPlayer.sessionId;
        
        this.state.players.delete(oldSessionId);
        existingPlayer.sessionId = client.sessionId;
        existingPlayer.connected = true;
        this.state.players.set(client.sessionId, existingPlayer);

        const orderIndex = this.state.playerOrder.indexOf(oldSessionId);
        if (orderIndex !== -1) {
          this.state.playerOrder[orderIndex] = client.sessionId;
        }

        if (this.state.host === oldSessionId) {
          this.state.host = client.sessionId;
        }

        // 재연결된 클라이언트에게 현재 방 상태 전송
        client.send("reconnected", {
          roomState: this.state,
          isHost: this.state.host === client.sessionId
        });

        // 다른 클라이언트에게 재연결 알림
        this.broadcast("playerReconnected", {
          playerId: client.sessionId,
          nickname: existingPlayer.nickname
        }, { except: client });

        return;
      }
    }

    console.log(`[MyRoom] New player ${client.sessionId} joining.`);
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.guestId = options.guestId || "";
    player.connected = true;

    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.unshift(client.sessionId);

    if (this.state.host === "") {
      this.state.host = client.sessionId;
    }

    this.broadcast("playerJoined", {
      playerId: client.sessionId,
      nickname: player.nickname || '익명',
      isHost: this.state.host === client.sessionId
    });
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    console.log(`[MyRoom] Player ${client.sessionId} disconnected. Consented: ${consented}`);
    player.connected = false;

    this.clock.setTimeout(() => {
      if (!player.connected) {
        console.log(`[MyRoom] Cleaning up disconnected player ${player.sessionId}`);
        this.removePlayer(player.sessionId);
      }
    }, 20000);
  }

  removePlayer(sessionId: string) {
    const wasHost = sessionId === this.state.host;
    this.state.players.delete(sessionId);
    const idx = this.state.playerOrder.indexOf(sessionId);
    if (idx !== -1) this.state.playerOrder.splice(idx, 1);
    if (wasHost) {
      const next = this.state.players.keys().next().value;
      this.state.host = next ? next : "";
    }
    this.broadcast("playerLeft", {
      playerId: sessionId,
      newHost: wasHost ? this.state.host : null
    });
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  startGame() {
    this.state.easyMode = [...this.state.players.values()].some(p => p.easyMode);
    this.state.maxNumber = this.maxNumberMap[this.state.players.size] ?? 15;
    this.state.round = 1;
  }

  startRound() {
    const maxNumber = this.state.maxNumber;
    const playerCount = this.state.players.size;
    const order = this.state.playerOrder;
    const deck = createShuffledDeck(maxNumber);
    const hands = dealCards(deck, playerCount);
    order.forEach((sessionId, i) => {
      const player = this.state.players.get(sessionId);
      if (player) {
        player.hand = new ArraySchema<number>(...hands[i]);
      }
    });
    const cloud3PlayerId = findPlayerWithCloud3(this.state.players, maxNumber);
    if (cloud3PlayerId === null) {
      throw new Error("구름 3 분배 누락 - 코드 버그!");
    }
    const cloud3Index = cloud3PlayerId !== null ? order.indexOf(cloud3PlayerId) : 0;
    this.state.nowPlayerIndex = cloud3Index;
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = 0;
    this.state.lastCards = new ArraySchema<number>();
    this.state.lastPlayerIndex = -1;
    for (const sessionId of this.state.playerOrder) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      const client = this.clients.find(c => c.sessionId === sessionId);
      if (!client) continue;
      client.send("roundStart", {
        hand: player.hand.slice(),
        score: player.score,
        nickname: player.nickname,
      });
    }
    this.broadcast("roundStarted", {
      playerOrder: this.state.playerOrder.slice(),
      round: this.state.round,
    });
  }

  nextPlayer() {
    this.state.nowPlayerIndex = (this.state.nowPlayerIndex + 1) % this.state.playerOrder.length;
    if(this.state.nowPlayerIndex === this.state.lastPlayerIndex) {
      this.state.lastType = 0;
      this.state.lastMadeType = MADE_NONE;
      this.state.lastHighestValue = 0;
      this.state.lastCards = new ArraySchema<number>();
      this.broadcast("cycleEnded", {});
    }
  }

  endRound() {
    if (this.state.easyMode) {
      const scoreMatrix = calculateRoundScoreMatrix(this.state.players, this.state.maxNumber);
      this.broadcast("scoreMatrixUpdate", { scoreMatrix });
    }
    const scoreDiffMap = calculateRoundScores(this.state.players, this.state.maxNumber);
    for (const [sessionId, diffScore] of scoreDiffMap.entries()) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      player.score += diffScore;
    }
    this.broadcast("scoreUpdate", {
      scores: Array.from(this.state.players.entries()).map(([id, p]) => ({
        playerId: id,
        score: p.score,
      })),
      round: this.state.round,
    });
    this.state.round += 1;
    if(this.state.round > this.state.totalRounds) this.endGame();
    else this.startRound();
  }

  endGame() {
    const finalScores = Array.from(this.state.players.entries()).map(([sessionId, player]) => ({
      playerId: sessionId,
      score: player.score,
      nickname: player.nickname,
    }));
    this.broadcast("gameEnded", { finalScores });
    this.resetGameState();
  }

  resetGameState() {
    this.state.round = 0;
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = 0;
    this.state.lastCards = new ArraySchema<number>();
    this.state.lastPlayerIndex = -1;
    this.state.nowPlayerIndex = 0;
    for (const player of this.state.players.values()) {
      player.score = 0;
      player.hand = new ArraySchema<number>();
      player.ready = false;
    }
    this.broadcast("gameReset", {});
  }
}
