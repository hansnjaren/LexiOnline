export interface Player {
  id: string;
  nickname: string;
  score: number;
  remainingTiles: number;
  isCurrentPlayer: boolean;
  sessionId: string;
  hasPassed: boolean;
}

export interface Card {
  id: number;
  value: number;
  color: string;
  originalNumber: number;
}

export interface BoardCard extends Card {
  isNew: boolean;
  row: number;
  col: number;
  playerId?: string;
  turnId?: number;
  submitTime?: number;
}

export interface GameState {
  lastType: number;
  lastMadeType: number;
  lastHighestValue: number;
  currentTurnId: number;
  maxNumber: number;
  round: number;
  totalRounds: number;
}
