// src/gameLogic/scoreCalculator.ts
import { MapSchema } from "@colyseus/schema";
import { PlayerState } from "../rooms/schema/PlayerState";
import { parseCard } from "./cardEvaluator";

/**
 * 점수 계산 함수
 * @param players - MapSchema<PlayerState>, 모든 플레이어 상태 맵
 * @param maxNumber - 카드 최대 숫자 (maxNumber)
 * @returns Map<string, number> - sessionId별 계산된 점수 차이 (가중치 포함)
 */
export function calculateRoundScores(
  players: MapSchema<PlayerState>,
  maxNumber: number
): Map<string, number> {
  // 1) 플레이어별 손패 개수 및 2 카드 개수 파악
  interface PlayerStats {
    handCount: number;
    twoCount: number; // 2의 개수 (내부 number가 maxNumber-1)
  }

  const statsMap = new Map<string, PlayerStats>();

  for (const [sessionId, player] of players.entries()) {
    const hand = player.hand;
    let twoCount = 0;
    hand.forEach(card => {
      const { number } = parseCard(card, maxNumber);
      if (number === maxNumber - 1) twoCount++;
    });

    statsMap.set(sessionId, {
      handCount: hand.length,
      twoCount,
    });
  }

  // 2) 가장 손패 많이 가진 플레이어 손패 개수
  let maxHandCount = 0;
  statsMap.forEach(stat => {
    if (stat.handCount > maxHandCount) maxHandCount = stat.handCount;
  });

  // 3) 플레이어별 점수 계산
  // 손패가 많은 플레이어가 손패 적은 플레이어에게 (차이 * 2의 개수 배수) 만큼 점수를 줌
  // 즉, 손패 많이 가진 쪽은 감점, 적게 가진 쪽은 가점 → 여기서는 "적게 가진 플레이어 포인트 올리기" 중심으로 계산

  // 결과를 sessionId별 점수 차이 맵으로 저장 (적게 가진 플레이어 +, 많이 가진 플레이어 -)
  const scoreDiffMap = new Map<string, number>();

  statsMap.forEach((stat, sessionId) => {
    const diff = maxHandCount - stat.handCount; // 차이 (음수일 일 없음)
    if (diff <= 0) {
      // 가장 많이 가진 플레이어는 감점 대상, 총합 보정 시 마이너스 또는 0 적용 가능
      scoreDiffMap.set(sessionId, 0);
    } else {
      // 차이 * 2배수만큼 점수 올림 (2가 있을수록 점수 배수 증가)
      scoreDiffMap.set(sessionId, diff * (2 ** stat.twoCount));
    }
  });

  return scoreDiffMap;
}

export function calculateRoundScoreMatrix(
  players: MapSchema<PlayerState>,
  maxNumber: number
): Record<string, Record<string, number>> {
  const playerIds = Array.from(players.keys());
  
  // 플레이어별 기본 통계
  interface PlayerStats {
    handCount: number;
    twoCount: number;
  }
  
  const statsMap = new Map<string, PlayerStats>();
  
  for (const [sessionId, player] of players.entries()) {
    let twoCount = 0;
    player.hand.forEach(card => {
      const { number } = parseCard(card, maxNumber);
      if (number === maxNumber - 1) twoCount++;
    });
    statsMap.set(sessionId, { handCount: player.hand.length, twoCount });
  }
  
  // 가장 많은 손패 개수 찾아두기
  let maxHandCount = 0;
  statsMap.forEach(s => {
    if (s.handCount > maxHandCount) maxHandCount = s.handCount;
  });
  
  // 2중 map: [점수를 주는사람][점수 받는사람]=score
  const scoreMatrix: Record<string, Record<string, number>> = {};
  
  // 초기화
  playerIds.forEach(giver => {
    scoreMatrix[giver] = {};
    playerIds.forEach(receiver => {
      scoreMatrix[giver][receiver] = 0;
    });
  });
  
  // 계산: 손패 많은 플레이어가 손패 적은 플레이어에게 점수 차이만큼 줌
  playerIds.forEach(giverId => {
    const giver = statsMap.get(giverId)!;
    playerIds.forEach(receiverId => {
      if (giverId === receiverId) return; // 자기 자신은 0
      const receiver = statsMap.get(receiverId)!;
      const diff = giver.handCount - receiver.handCount;
      if (diff > 0) {
        const score = diff * (2 ** receiver.twoCount);
        // 점수는 손패 많은 사람이 손패 적은 사람에게 준다는 의미로 기록
        scoreMatrix[giverId][receiverId] = score;
      }
    });
  });
  
  return scoreMatrix;
}