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
import prisma from "../../prisma/client";
import jwt, { JwtPayload } from "jsonwebtoken"
import {
  handleSubmit,
  handlePass,
  handleReady,
  handleEasyMode,
  handleSortOrder,
  IMyRoom,
} from "../roomLogic/messageHandlers";
import { calculateRanks } from "../gameLogic/calculateRanks";
import { calculateRatings } from "../gameLogic/calculateRatings";
import { DEFAULT_RATING_MU, DEFAULT_RATING_SIGMA } from "../constants/rating";

export class MyRoom extends Room<MyRoomState> implements IMyRoom {
  maxClients = 5;
  state = new MyRoomState();
  private finalGameResult: any = null;
  
  autoDispose = false;

  maxNumberMap: Record<number, number> = { 3: 9, 4: 13, 5: 15 };

  onCreate(options: any) {
    console.log(`[DEBUG] 방 생성됨: ${this.roomId}`);
    this.onMessage("changeRounds", (client, data) => {
      if (client.sessionId !== this.state.host) {
        client.send("changeRejected", { reason: "Only the host can change rounds." });
        return;
      }
      const newRounds = data.rounds;
      if (typeof newRounds === "number" && newRounds > 0) {
        this.state.totalRounds = newRounds;
        this.broadcast("totalRoundsUpdated", { totalRounds: newRounds });
      } else {
        client.send("changeRejected", { reason: "Invalid round count." });
      }
    });

    this.onMessage("submit", (client, data) => handleSubmit(this, client, data));
    this.onMessage("pass", (client) => handlePass(this, client));
    this.onMessage("ready", (client, data) => handleReady(this, client, data));
    this.onMessage("easyMode", (client, data) => handleEasyMode(this, client, data));
    this.onMessage("sortOrder", (client, data) => handleSortOrder(this, client, data));
    
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

    this.onMessage("requestPlayerInfo", (client) => {
      const allPlayers = Array.from(this.state.players.entries()).map(([id, p]) => ({
        sessionId: id,
        nickname: p.nickname || '익명',
        score: p.score || 0,
        remainingTiles: p.hand ? p.hand.length : 0,
        isCurrentPlayer: id === client.sessionId
      }));
      const myPlayer = this.state.players.get(client.sessionId);
      const myHand = myPlayer && myPlayer.hand ? Array.from(myPlayer.hand) : [];
      const sortedHand = myPlayer && myPlayer.sortedHand.length > 0 
        ? Array.from(myPlayer.sortedHand)
        : myHand;
      
      client.send("playerInfoResponse", {
        players: allPlayers,
        playerOrder: this.state.playerOrder.slice(),
        isGameStarted: this.state.round > 0,
        myHand: sortedHand,
        maxNumber: this.state.maxNumber,
        round: this.state.round,
        totalRounds: this.state.totalRounds
      });
    });

    this.onMessage("readyForNextRound", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.readyForNextRound = true;
        this.broadcast("readyForNextRound", { playerId: client.sessionId, ready: true });
        const allReady = Array.from(this.state.players.values()).every(p => p.readyForNextRound);
        if (allReady) {
          this.broadcast("allPlayersReadyForNextRound");
          this.startRound();
        }
      }
    });

    this.onMessage("playAgain", (client) => {
      this.resetGameState();
      this.broadcast("gameReset", {});
    });

    this.onMessage("requestReadyStatus", (client) => {
      const readyPlayerIds = Array.from(this.state.players.entries())
        .filter(([id, player]) => player.readyForNextRound)
        .map(([id, player]) => id);
      client.send("readyStatusResponse", {
        readyPlayers: readyPlayerIds,
        totalPlayers: this.state.players.size
      });
    });

    this.onMessage("requestFinalResult", (client) => {
      if (this.finalGameResult) {
        client.send("finalResult", this.finalGameResult);
      } else {
        client.send("finalResultNotReady");
      }
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
          return;
        }
      }
      this.startGame();
      this.startRound();
      this.broadcast("gameStarted", { totalRounds: this.state.totalRounds, easyMode: this.state.easyMode });
    });
  }

  async onJoin(client: Client, options: any) {
    // --- Reconnection Logic (for both lobby and in-game) ---
    let existingPlayer: PlayerState | undefined;

    // Try to find an existing disconnected player to reconnect
    if (options.authToken) {
        try {
            const decoded = jwt.verify(options.authToken, process.env.JWT_SECRET) as JwtPayload & { userId?: number };
            if (decoded.userId) {
                existingPlayer = Array.from(this.state.players.values()).find(p => p.userId === decoded.userId && !p.connected);
            }
        } catch (err) {
            console.log("[MyRoom] Auth token invalid during reconnection attempt.");
        }
    }

    if (!existingPlayer && options.guestId) {
        existingPlayer = Array.from(this.state.players.values()).find(p => p.guestId === options.guestId && !p.connected);
    }

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

        client.send("reconnected", { roomState: this.state, isHost: this.state.host === client.sessionId });
        
        const playersList = Array.from(this.state.players.entries()).map(([id, p]) => ({
          playerId: id,
          nickname: p.nickname || '익명',
          isReady: p.ready,
          isHost: this.state.host === id,
          easyMode: p.easyMode
        }));
        
        this.broadcast("playersUpdated", {
          players: playersList
        });
        return;
    }

    // If game has started and it's not a reconnection, reject.
    if (this.state.round > 0) {
        throw new Error("게임이 이미 시작되어 참여할 수 없습니다.");
    }

    // --- New Player Logic ---
    console.log(`[MyRoom] New player ${client.sessionId} joining.`);
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.guestId = options.guestId || "";
    player.connected = true;

    if (options.authToken) {
      try {
        const decoded = jwt.verify(options.authToken, process.env.JWT_SECRET) as JwtPayload & { userId?: number };
        const userId = decoded.userId ?? null;
        if (userId) {
            const existingPlayerWithSameUserId = Array.from(this.state.players.values()).find(p => p.userId === userId);
            if (existingPlayerWithSameUserId) {
                console.log(`[MyRoom] Existing player ${userId} found. Re-assigning session.`);
                this.state.players.delete(existingPlayerWithSameUserId.sessionId);
                
                const orderIndex = this.state.playerOrder.indexOf(existingPlayerWithSameUserId.sessionId);
                if (orderIndex !== -1) this.state.playerOrder.splice(orderIndex, 1);

                Object.assign(player, existingPlayerWithSameUserId);
                player.sessionId = client.sessionId;
                player.connected = true;

            } else {
                player.userId = userId;
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { rating_mu: true, rating_sigma: true, nickname: true }
                });
                if (user) {
                    player.ratingMu = user.rating_mu;
                    player.ratingSigma = user.rating_sigma;
                    player.nickname = user.nickname || `User #${userId}`;
                }
            }
        }
      } catch (err) {
        player.userId = null;
      }
    }

    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.unshift(client.sessionId);

    if (this.state.host === "") {
      this.state.host = client.sessionId;
    }

    const playersList = Array.from(this.state.players.entries()).map(([id, p]) => ({
      playerId: id,
      nickname: p.nickname || '익명',
      isReady: p.ready,
      isHost: this.state.host === id,
      easyMode: p.easyMode
    }));
    
    this.broadcast("playersUpdated", {
      players: playersList
    });
  }

  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    console.log(`[MyRoom] Player ${client.sessionId} left. Consented: ${consented}, Round: ${this.state.round}`);
    player.connected = false;

    if (consented) {
      console.log(`[MyRoom] Player ${player.nickname} left consensually. Removing immediately.`);
      this.removePlayer(player.sessionId, true);
    } else {
      console.log(`[MyRoom] Player ${player.nickname} disconnected. Allowing 10 seconds to reconnect.`);
      this.clock.setTimeout(() => {
        if (!player.connected) {
          console.log(`[MyRoom] Player ${player.nickname} did not reconnect in time. Removing.`);
          this.removePlayer(player.sessionId, true);
        }
      }, 10000); // 10 seconds grace time
    }
  }

  removePlayer(sessionId: string, changeHost: boolean) {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    const wasHost = sessionId === this.state.host;
    this.state.players.delete(sessionId);
    
    const idx = this.state.playerOrder.indexOf(sessionId);
    if (idx !== -1) this.state.playerOrder.splice(idx, 1);
    
    if (wasHost && changeHost && this.state.playerOrder.length > 0) {
      this.state.host = this.state.playerOrder[0];
      console.log(`[MyRoom] Host changed to ${this.state.host}`);
    } else if (this.state.playerOrder.length === 0) {
      this.state.host = "";
    }
    
    const playersList = Array.from(this.state.players.entries()).map(([id, p]) => ({
      playerId: id,
      nickname: p.nickname || '익명',
      isReady: p.ready,
      isHost: this.state.host === id,
      easyMode: p.easyMode
    }));
    
    this.broadcast("playersUpdated", {
      players: playersList
    });
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  startGame() {
    this.state.easyMode = [...this.state.players.values()].some(p => p.easyMode);
    this.state.maxNumber = this.maxNumberMap[this.state.players.size] ?? 15;
    this.state.round = 1;
    this.lock();
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
        player.sortedHand.clear();
      }
    });
    const cloud3PlayerId = findPlayerWithCloud3(this.state.players, maxNumber);
    
    if (cloud3PlayerId === null) {
      throw new Error("구름 3 분배 누락 - 코드 버그!");
    }
    const cloud3Index = order.indexOf(cloud3PlayerId);
    this.state.nowPlayerIndex = cloud3Index;
    
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = -1;
    this.state.lastCards = new ArraySchema<number>();
    this.state.lastPlayerIndex = -1;
    this.state.currentTurnId = 0;

    for (const sessionId of this.state.playerOrder) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      const client = this.clients.find(c => c.sessionId === sessionId);
      if (!client) continue;

      client.send("roundStart", {
        hand: player.hand.slice(),
        score: player.score,
        nickname: player.nickname,
        maxNumber: this.state.maxNumber,
        allPlayers: Array.from(this.state.players.entries()).map(([id, p]) => ({
          sessionId: id,
          nickname: p.nickname || '익명',
          score: p.score,
          remainingTiles: p.hand ? p.hand.length : 0,
          isCurrentPlayer: id === this.state.playerOrder[this.state.nowPlayerIndex]
        }))
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
      this.state.lastHighestValue = -1;
      this.state.lastCards = new ArraySchema<number>();
      
      for (const player of this.state.players.values()) {
        player.hasPassed = false;
      }
      
      this.broadcast("passReset", {});
      this.broadcast("cycleEnded", {});
    }
    
    this.broadcast("turnChanged", {
      currentPlayerId: this.state.playerOrder[this.state.nowPlayerIndex],
      allPlayers: Array.from(this.state.players.entries()).map(([id, p]) => ({
        sessionId: id,
        nickname: p.nickname || '익명',
        score: p.score,
        remainingTiles: p.hand ? p.hand.length : 0,
        isCurrentPlayer: id === this.state.playerOrder[this.state.nowPlayerIndex]
      }))
    });
  }

  async endRound() {
    const scoreDiffMap = calculateRoundScores(this.state.players, this.state.maxNumber);
    const finalScores = Array.from(this.state.players.entries()).map(([id, p]) => ({
      playerId: id,
      score: p.hand ? p.hand.length : 0,
      nickname: p.nickname || '익명',
      scoreDiff: scoreDiffMap.get(id) || 0,
      remainingTiles: p.hand ? p.hand.length : 0,
    })).sort((a, b) => a.score - b.score);

    const finalHands: Record<string, number[]> = {};
    this.state.players.forEach((player, sessionId) => {
      finalHands[sessionId] = Array.from(player.hand);
    });

    const comprehensiveResult = {
      scoreMatrix: calculateRoundScoreMatrix(this.state.players, this.state.maxNumber),
      scores: finalScores,
      finalHands,
      round: this.state.round,
      isGameEnd: this.state.round >= this.state.totalRounds,
    };

    for (const [sessionId, diffScore] of scoreDiffMap.entries()) {
      const player = this.state.players.get(sessionId);
      if (player) player.score += diffScore;
    }

    for (const player of this.state.players.values()) {
      player.readyForNextRound = false;
    }

    this.broadcast("roundEnded", comprehensiveResult);

    if (comprehensiveResult.isGameEnd) {
      this.endGame().catch(e => console.error("[ERROR] endGame 실행 중 오류 발생:", e));
    } else {
      this.state.round++;
      this.broadcast("waitingForNextRound");
    }
  }

  async endGame() {
    const finalScores = Array.from(this.state.players.entries()).map(([sessionId, player]) => ({
      playerId: sessionId,
      userId: player.userId,
      score: player.score,
      nickname: player.nickname,
      rating_mu_before: player.ratingMu,
      rating_sigma_before: player.ratingSigma
    }));

    const finalScoresWithRank = calculateRanks(finalScores);
    const finalScoresWithRating = calculateRatings(finalScoresWithRank);

    const dbSaveResults = [];

    for (const playerData of finalScoresWithRating) {
      const { userId, score, rank, rating_mu_before, rating_sigma_before, rating_mu_after, rating_sigma_after } = playerData;
      
      if (!userId) {
        dbSaveResults.push({ userId: null, success: false, reason: 'Not a logged-in user' });
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.gameHistory.create({
            data: {
              userId,
              playerCount: finalScores.length,
              rank,
              score,
              scoresAll: finalScores.map(f => f.score),
              rating_mu_before,
              rating_sigma_before,
              rating_mu_after,
              rating_sigma_after,
              gameId: this.roomId,
            },
          });

          await tx.user.update({
            where: { id: userId },
            data: {
              rating_mu: rating_mu_after,
              rating_sigma: rating_sigma_after,
            },
          });
        });
        dbSaveResults.push({ userId, success: true });
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'An unknown error occurred';
        dbSaveResults.push({ userId, success: false, reason });
      }
    }

    this.finalGameResult = { 
      finalScores: finalScoresWithRating,
      dbSaveResults 
    };

    this.broadcast("gameIsOver");
  }

  resetGameState() {
    this.unlock();
    this.state.round = 0;
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = -1;
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
