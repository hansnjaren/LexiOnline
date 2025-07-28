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
  IMyRoom,
} from "../roomLogic/messageHandlers";
import { calculateRanks } from "../gameLogic/calculateRanks";
import { calculateRatings } from "../gameLogic/calculateRatings";
import { DEFAULT_RATING_MU, DEFAULT_RATING_SIGMA } from "../constants/rating";

export class MyRoom extends Room<MyRoomState> implements IMyRoom {
  maxClients = 5;
  state = new MyRoomState();

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

    // 메시지 핸들러 분리한 함수 사용
    this.onMessage("submit", (client, data) => handleSubmit(this, client, data));
    this.onMessage("pass", (client) => handlePass(this, client));
    this.onMessage("ready", (client, data) => handleReady(this, client, data));
    this.onMessage("easyMode", (client, data) => handleEasyMode(this, client, data));

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

  async onJoin(client: Client, options: any) {
    const player = new PlayerState();
    player.sessionId = client.sessionId;
    if (options.authToken) {
      try {
        const decoded = jwt.verify(options.authToken, process.env.JWT_SECRET) as JwtPayload & { userId?: number };
        player.userId = decoded.userId ?? null; // JWT payload에 userId가 들어있다고 가정
        // ratingMu, ratingSigma setting
        if (player.userId !== null) {
          // DB에서 rating 값 조회 (예: Prisma 사용)
          const user = await prisma.user.findUnique({
            where: { id: player.userId },
            select: { rating_mu: true, rating_sigma: true }
          });

          if (user) {
            player.ratingMu = user.rating_mu;
            player.ratingSigma = user.rating_sigma;
          } else {
            // DB에 유저가 없으면 기본값 할당
            player.ratingMu = DEFAULT_RATING_MU;
            player.ratingSigma = DEFAULT_RATING_SIGMA;
          }
        } else {
          // 비로그인 유저 기본값
          player.ratingMu = DEFAULT_RATING_MU;
          player.ratingSigma = DEFAULT_RATING_SIGMA;
        }
      } catch (err) {
        player.userId = null; // 비로그인/비정상 토큰
        player.ratingMu = DEFAULT_RATING_MU
        player.ratingSigma = DEFAULT_RATING_SIGMA
      }
    } else {
      player.userId = null; // 비로그인 유저
      player.ratingMu = DEFAULT_RATING_MU
      player.ratingSigma = DEFAULT_RATING_SIGMA
    }
    this.state.players.set(client.sessionId, player);
    this.state.playerOrder.unshift(client.sessionId);

    if (this.state.host === "") {
      this.state.host = client.sessionId;
    }
  }

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);

    const idx = this.state.playerOrder.indexOf(client.sessionId);
    if (idx !== -1) this.state.playerOrder.splice(idx, 1);

    if (client.sessionId === this.state.host) {
      const next = this.state.players.keys().next().value;
      this.state.host = next ? next : "";
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

  startGame() {
    // easyMode 설정: 플레이어 가운데 하나라도 easyMode true면 활성화
    this.state.easyMode = [...this.state.players.values()].some(p => p.easyMode);
    this.state.maxNumber = this.maxNumberMap[this.state.players.size] ?? 15;

    // 초기화 작업 예: 턴순, 라운드 등
    this.state.round = 1;
  }

  startRound() {
    const maxNumber = this.state.maxNumber;
    const playerCount = this.state.players.size;

    // playerOrder가 이미 입장 역순으로 관리되고 있다고 가정
    const order = this.state.playerOrder;

    // 1) 덱 생성 및 셔플
    const deck = createShuffledDeck(maxNumber);

    // 2) 카드 분배
    const hands = dealCards(deck, playerCount);

    // 3) 분배된 카드를 playerOrder 기준으로 할당
    order.forEach((sessionId, i) => {
      const player = this.state.players.get(sessionId);
      if (player) {
        player.hand = new ArraySchema<number>(...hands[i]);
      }
    });

    // 4) 구름 3 가진 플레이어 찾기 (playerOrder 기준)
    const cloud3PlayerId = findPlayerWithCloud3(this.state.players, maxNumber);

    if (cloud3PlayerId === null) {
      console.error("[BUG] 구름3이 분배되지 않음! 코드 버그 점검 필요");
      this.broadcast("debugError", { reason: "구름 3 분배 누락" });
      throw new Error("구름 3 분배 누락 - 코드 버그!");
    }

    // 5) 그 플레이어 인덱스 추출
    const cloud3Index = cloud3PlayerId !== null ? order.indexOf(cloud3PlayerId) : 0;

    this.state.nowPlayerIndex = cloud3Index;

    // 6) 기타 상태 초기화
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = 0;
    this.state.lastCards = new ArraySchema<number>();
    this.state.lastPlayerIndex = -1;

    // 7) 카드 분배 후 각 플레이어마다 자신의 상태 보내기
    for (const sessionId of this.state.playerOrder) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;

      const client = this.clients.find(c => c.sessionId === sessionId);
      if (!client) continue;

      client.send("roundStart", {
        hand: player.hand.slice(),  // ArraySchema -> 일반 배열로 변환
        score: player.score,
        nickname: player.nickname,
        // 기타 필요한 정보
      });
    }

    // 8) 라운드 시작 알림
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
    // 턴 변경 시 추가 액션 처리 가능
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
      player.score += diffScore; // 기존 점수에 차이만큼 가감
    }

  // 변경된 점수 등을 클라이언트에 알림 원하면 broadcast 추가
    this.broadcast("scoreUpdate", {
      scores: Array.from(this.state.players.entries()).map(([id, p]) => ({
        playerId: id,
        score: p.score,
      })),
      round: this.state.round,
    });
    // 라운드 진행, 전체 라운드 종료 시 게임 종료
    this.state.round += 1;
    if(this.state.round > this.state.totalRounds) this.endGame();
    else this.startRound();
  }

  // === 수정된 부분 (게임 종료 시 DB 저장)
  async endGame() {
    // 1) 최종 점수 수집
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

    // 4) 로그인 유저에 대해서만 DB 저장
    for (const { userId, score, rank, rating_mu_before, rating_sigma_before, rating_mu_after, rating_sigma_after } of finalScoresWithRating) {
      if (!userId) {
        // 비로그인 유저면 저장하지 않고 건너뜀
        continue;
      }

      try {
        await prisma.gameHistory.create({
          data: {
            userId,
            playerCount: finalScores.length,
            rank,
            score,
            scoresAll: finalScores.map(f => f.score), // 모든 참가자 점수 배열
            rating_mu_before,
            rating_sigma_before,
            rating_mu_after,
            rating_sigma_after,
            gameId: this.roomId,
          },
        });
      } catch (err) {
        console.error(`Failed to save game history for user ${userId}`, err);
      }
    }

    // 3) 최종 점수 클라이언트에 방송
    this.broadcast("gameEnded", { finalScoresWithRating });

    // 4) 게임 상태 초기화 또는 대기 상태로 전환
    this.resetGameState();
  }


  resetGameState() {
    // 라운드, 점수, 각종 상태 초기화
    this.state.round = 0;
    this.state.lastType = 0;
    this.state.lastMadeType = MADE_NONE;
    this.state.lastHighestValue = 0;
    this.state.lastCards = new ArraySchema<number>();
    this.state.lastPlayerIndex = -1;
    this.state.nowPlayerIndex = 0;

    // 플레이어 점수 초기화 (원하면)
    for (const player of this.state.players.values()) {
      player.score = 0;
      player.hand = new ArraySchema<number>(); // 손패 초기화
      player.ready = false; // 준비 상태 초기화 (필요시)
    }

    // playerOrder 자체는 유지하되, 필요하면 초기화 가능
    // this.state.playerOrder.clear(); // 또는 유지

    // host 등 기타 상태 유지

    // 클라이언트에게 게임 초기 상태 알림 (옵션)
    this.broadcast("gameReset", {});
  }

}
