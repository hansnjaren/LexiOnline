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
    console.log(`[DEBUG] 5장 카드 평가: cards=${submitCards.join(', ')}, maxNumber=${room.state.maxNumber}`);
    result = evaluateMade(submitCards, room.state.maxNumber);
    console.log(`[DEBUG] 평가 결과: type=${result.type}, value=${result.value}, valid=${result.valid}`);
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

  // pass 스티커 때문에 추가함
  // 모든 플레이어의 pass 상태 리셋 (새로운 패가 제출되었으므로)
  for (const player of room.state.players.values()) {
    player.hasPassed = false;
  }
  
  // pass 스티커 때문에 추가함
  // pass 상태 리셋을 모든 클라이언트에게 브로드캐스트
  room.broadcast("passReset", {
    message: "새로운 패가 제출되어 pass 상태가 리셋되었습니다."
  });

  // 상태 업데이트
  room.state.lastType = submitCards.length;
  room.state.lastCards = new ArraySchema<number>(...submitCards);
  room.state.lastPlayerIndex = room.state.nowPlayerIndex;

  // 카드 위치 결정 (모든 유저에게 동일한 위치 보장)
  const boardSize = { rows: 4, cols: 15 }; // 기본 보드 크기
  const currentTurnId = room.state.round; // 턴 ID로 라운드 번호 사용
  
  // 게임 보드 동기화 관련
  // 현재 게임 보드 상태를 room.state에서 가져오기
  const boardCards: Array<{ row: number; col: number; turnId: number }> = [];
  for (let i = 0; i < room.state.boardCards.length; i++) {
    boardCards.push({
      row: room.state.boardRows[i],
      col: room.state.boardCols[i],
      turnId: room.state.boardTurnIds[i]
    });
  }
  
  // 위치 결정
  const positionResult = findCardPosition(submitCards, boardCards, boardSize, currentTurnId);
  
  if (positionResult.success && positionResult.position) {
    console.log(`[DEBUG] 카드 위치 결정: row=${positionResult.position.row}, col=${positionResult.position.col}`);
    
    // 게임 보드 동기화 관련
    // 게임 보드 상태에 새로운 카드들 추가
    for (let i = 0; i < submitCards.length; i++) {
      room.state.boardCards.push(submitCards[i]);
      room.state.boardRows.push(positionResult.position!.row);
      room.state.boardCols.push(positionResult.position!.col + i);
      room.state.boardTurnIds.push(currentTurnId);
    }
    
    room.broadcast("submitted", { 
      cards: submitCards, 
      playerId: client.sessionId,
      position: positionResult.position,
      maxNumber: room.state.maxNumber
    });
  } else {
    console.log(`[DEBUG] 카드 위치 결정 실패, 기본 위치 사용`);
    // 위치를 찾지 못한 경우 기본 위치 사용
    const defaultPosition = { row: 0, col: 0 };
    
    // 게임 보드 동기화 관련
    // 게임 보드 상태에 새로운 카드들 추가
    for (let i = 0; i < submitCards.length; i++) {
      room.state.boardCards.push(submitCards[i]);
      room.state.boardRows.push(defaultPosition.row);
      room.state.boardCols.push(defaultPosition.col + i);
      room.state.boardTurnIds.push(currentTurnId);
    }
    
    room.broadcast("submitted", { 
      cards: submitCards, 
      playerId: client.sessionId,
      position: defaultPosition,
      maxNumber: room.state.maxNumber
    });
  }

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
  
  // pass 스티커 때문에 추가함
  // 현재 플레이어의 pass 상태를 true로 설정
  const currentPlayer = room.state.players.get(client.sessionId);
  if (currentPlayer) {
    currentPlayer.hasPassed = true;
  }
  
  // pass 상태를 모든 클라이언트에게 브로드캐스트
  room.broadcast("playerPassed", {
    playerId: client.sessionId,
    hasPassed: true
  });
  
  // 전체 멤버수-1명이 pass했는지 확인
  const passedPlayersCount = Array.from(room.state.players.values()).filter(p => p.hasPassed).length;
  const totalPlayersCount = room.state.players.size;
  
  if (passedPlayersCount >= totalPlayersCount - 1) {
    // 모든 플레이어의 pass 상태 리셋
    for (const player of room.state.players.values()) {
      player.hasPassed = false;
    }
    
    // pass 상태 리셋을 모든 클라이언트에게 브로드캐스트
    room.broadcast("passReset", {
      message: "모든 플레이어가 pass하여 새로운 라운드가 시작됩니다."
    });
    
    // 게임보드의 패들은 그대로 유지하고 pass 상태만 리셋
    // lastType, lastMadeType, lastHighestValue, lastCards는 그대로 유지
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

// 카드 위치 결정 함수 (프론트엔드와 동일한 로직)
function findCardPosition(
  newCards: number[],
  boardCards: Array<{ row: number; col: number; turnId: number }>,
  boardSize: { rows: number; cols: number },
  currentTurnId: number
): { success: boolean; position?: { row: number; col: number } } {
  // 가능한 모든 위치를 찾아서 랜덤하게 선택
  const availablePositions: Array<{ row: number; col: number }> = [];
  
  // 모든 행에서 시도
  for (let row = 0; row < boardSize.rows; row++) {
    // 해당 행의 모든 기존 카드 위치 확인
    const rowCards = boardCards.filter(c => c.row === row).sort((a, b) => a.col - b.col);
    
    // 해당 행에 카드가 없으면 모든 위치가 가능
    if (rowCards.length === 0) {
      if (newCards.length <= boardSize.cols) {
        for (let startCol = 0; startCol <= boardSize.cols - newCards.length; startCol++) {
          availablePositions.push({ row, col: startCol });
        }
      }
      continue;
    }
    
    // 기존 카드들 사이의 빈 공간 찾기
    for (let startCol = 0; startCol <= boardSize.cols - newCards.length; startCol++) {
      let canPlace = true;
      
      // 1. 새로운 카드들이 들어갈 위치에 기존 카드가 있는지 확인
      for (let i = 0; i < newCards.length; i++) {
        const col = startCol + i;
        const existingCard = rowCards.find(c => c.col === col);
        if (existingCard) {
          canPlace = false;
          break;
        }
      }
      
      if (!canPlace) continue;
      
      // 2. 좌측 여백 확인 (새로운 카드들 왼쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
      const leftCard = rowCards.find(c => c.col === startCol - 1);
      if (leftCard) {
        canPlace = false;
        continue;
      }
      
      // 3. 우측 여백 확인 (새로운 카드들 오른쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
      const rightCard = rowCards.find(c => c.col === startCol + newCards.length);
      if (rightCard) {
        canPlace = false;
        continue;
      }
      
      if (canPlace) {
        availablePositions.push({ row, col: startCol });
      }
    }
  }
  
  // 가능한 위치가 있으면 랜덤하게 선택
  if (availablePositions.length > 0) {
    const randomIndex = Math.floor(Math.random() * availablePositions.length);
    return { success: true, position: availablePositions[randomIndex] };
  }
  
  return { success: false };
}
