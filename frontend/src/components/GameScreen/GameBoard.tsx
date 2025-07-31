import React from 'react';
import { BoardCard } from './types';
import { useCardUtils } from './hooks/useCardUtils';

interface GameBoardProps {
  boardCards: BoardCard[];
  boardSize: { rows: number; cols: number };
  gameMode: 'easyMode' | 'normal';
  showBoardMask: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ boardCards, boardSize, gameMode, showBoardMask }) => {
  // A dummy gameState is enough if useCardUtils only needs getDisplayColor and getCardImage
  const dummyGameState = { lastType: 0, lastMadeType: 0, lastHighestValue: 0, currentTurnId: 0, maxNumber: 13, round: 1, totalRounds: 5 };
  const { getDisplayColor, getCardImage } = useCardUtils(dummyGameState, gameMode);

  const maxTurnId = boardCards.length > 0 
    ? Math.max(...boardCards.map(c => c.turnId ?? 0))
    : 0;

  return (
    <div className="game-board-section">
      {showBoardMask && <div className="board-mask"></div>}
      <div 
        className="game-board"
        style={{ '--board-cols': boardSize.cols } as React.CSSProperties}
      >
        {Array.from({ length: boardSize.rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="board-row">
            {Array.from({ length: boardSize.cols }).map((_, colIndex) => {
              const card = boardCards.find(c => c.row === rowIndex && c.col === colIndex);
              const isMostRecent = card?.turnId === maxTurnId;
              
              return (
                <div key={colIndex} className="board-slot">
                  {card && (
                    <div className={`board-card ${getDisplayColor(card.color)} ${isMostRecent ? 'new-card' : ''}`}>
                      {getCardImage(getDisplayColor(card.color)) && (
                        <img 
                          src={getCardImage(getDisplayColor(card.color))!} 
                          alt={getDisplayColor(card.color)} 
                          className="card-image"
                        />
                      )}
                      <span className="card-value">{card.value || '?'}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameBoard;
