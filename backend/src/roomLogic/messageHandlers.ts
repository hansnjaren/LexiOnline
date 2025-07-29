// roomLogic/messageHandlers.ts
import { Room, Client } from "@colyseus/core";
import { MyRoomState } from "../rooms/schema/MyRoomState";
import { ArraySchema } from "@colyseus/schema"
import {
  evaluateSimpleCombo,
  evaluateMade,
  removeCardsFromHand,
  MadeEvalResult,
  MADE_NONE,
} from "../gameLogic/cardEvaluator";

// MyRoom이 구현해야 할 메서드를 포함하는 인터페이스
export interface IMyRoom extends Room<MyRoomState> {
  nextPlayer(): void;
  endRound(): void;
}

// submit 메시지 처리
export function handleSubmit(room: IMyRoom, client: Client, data: any) {
  const submitCards: number[] = data.submitCards.map((item: string) => parseInt(item, 10));
  
  console.log(`[DEBUG] 카드 제출 시도: player=${client.sessionId}, cards=${submitCards.join(', ')}`);

  // 턴 검사
  console.log(`[DEBUG] 턴 검사: client=${client.sessionId}, currentPlayer=${room.state.playerOrder[room.state.nowPlayerIndex]}, nowPlayerIndex=${room.state.nowPlayerIndex}`);
  if (client.sessionId !== room.state.playerOrder[room.state.nowPlayerIndex]) {
    console.log(`[DEBUG] 턴 거부: ${client.sessionId}는 현재 턴이 아님`);
    client.send("submitRejected", { reason: "Not your turn." });
    return;
  }

  // 제출 카드 수 검사
  if (submitCards.length === 0) {
    client.send("submitRejected", { reason: "Submit any card or pass." });
    return;
  }
  if (submitCards.length === 4) {
    client.send("submitRejected", { reason: "You cannot submit 4 cards." });
    return;
  }
  if (submitCards.length > 5) {
    client.send("submitRejected", { reason: "You cannot submit more than 5 cards." });
    return;
  }

  // lastType 0이면 첫 제출로 타입 자유, 0 아니면 길이 동일해야 함
  if (room.state.lastType !== 0 && submitCards.length !== room.state.lastType) {
    client.send("submitRejected", { reason: "Wrong cards: different type." });
    return;
  }

  const player = room.state.players.get(client.sessionId);
  if (!player) {
    client.send("invalidPlayer", { reason: "Player information invalid." });
    room.disconnect();
    return;
  }

  // 카드 소유 여부 확인
  console.log(`[DEBUG] 플레이어 손패: ${player.hand.join(', ')}`);
  for (const card of submitCards) {
    if (!player.hand.includes(card)) {
      console.log(`[DEBUG] 카드 ${card}를 보유하지 않음!`);
      client.send("noCard", { reason: "You do not hold this card." });
      return;
    }
  }

  let result: MadeEvalResult;

  if (submitCards.length < 4) {
    result = evaluateSimpleCombo(submitCards, room.state.maxNumber);
    if (!result.valid) {
      client.send("submitRejected", { reason: "Wrong cards: invalid combo." });
      return;
    }
    if (room.state.lastHighestValue >= result.value) {
      client.send("submitRejected", { reason: "Wrong cards: order is lower." });
      return;
    }
    room.state.lastHighestValue = result.value;
    room.state.lastMadeType = MADE_NONE;
  } else {
    result = evaluateMade(submitCards, room.state.maxNumber);
    if (!result.valid) {
      client.send("submitRejected", { reason: "Wrong cards: not made cards." });
      return;
    }
    if (
      result.type < room.state.lastMadeType ||
      (result.type === room.state.lastMadeType && result.value <= room.state.lastHighestValue)
    ) {
      client.send("submitRejected", { reason: "Wrong cards: order is lower." });
      return;
    }
    room.state.lastMadeType = result.type;
    room.state.lastHighestValue = result.value;
  }

  // 제출 카드 손패에서 제거
  removeCardsFromHand(player.hand, submitCards);

  // 상태 업데이트
  room.state.lastType = submitCards.length;
  room.state.lastCards = new ArraySchema<number>(...submitCards);
  room.state.lastPlayerIndex = room.state.nowPlayerIndex;

  room.broadcast("submitted", { cards: submitCards, playerId: client.sessionId });

  // 플레이어 손패 비었으면 라운드 종료 호출
  if (player.hand.length === 0) {
    room.endRound();
    return;
  }

  // 다음 플레이어로 턴 이동
  room.nextPlayer();
}

// pass 메시지 처리
export function handlePass(room: IMyRoom, client: Client) {
  if (client.sessionId !== room.state.playerOrder[room.state.nowPlayerIndex]) {
    client.send("passRejected", { reason: "Not your turn." });
    return;
  }
  room.nextPlayer();
}

// ready 상태 변경 처리
export function handleReady(room: IMyRoom, client: Client, data: any) {
  const player = room.state.players.get(client.sessionId);
  if (!player) return;

  if (typeof data.ready === "boolean") {
    player.ready = data.ready;
  } else {
    // 토글 방식 (필요 시 주석 해제)
    // player.ready = !player.ready;
  }

  room.broadcast("readyUpdate", {
    playerId: client.sessionId,
    ready: player.ready,
  });
}

// easyMode 상태 변경 처리
export function handleEasyMode(room: IMyRoom, client: Client, data: any) {
  const player = room.state.players.get(client.sessionId);
  if (!player) return;

  if (typeof data.easyMode === "boolean") {
    player.easyMode = data.easyMode;

    // 토글로 바꾸고 싶을 때 (필요시 주석 해제)
    // player.easyMode = !player.easyMode;
  } else {
    // player.easyMode = !player.easyMode;
  }

  room.state.easyMode = [...room.state.players.values()].some(p => p.easyMode);

  // room.broadcast("easyModeUpdated", {
  //   playerId: client.sessionId,
  //   easyMode: player.easyMode,
  //   roomEasyMode: room.state.easyMode,
  // });
}

// parseCard 임포트용 타입 선언 (실제 import는 MyRoom.ts에서 진행)
declare function parseCard(card: number, maxNumber: number): { type: number; number: number };
