import React, { RefObject } from 'react';
import { Card } from './types';
import { useCardUtils } from './hooks/useCardUtils';

interface MyHandProps {
  handRef: React.Ref<HTMLDivElement>;
  visibleHand: Card[];
  sortedHand: Card[];
  selectedCards: number[];
  draggedCard: number | null;
  isSorting: boolean;
  cardOffsets: { [key: number]: number };
  showCardDealAnimation: boolean;
  dealtCards: Set<number>;
  gameMode: 'easyMode' | 'normal';
  handleCardSelect: (id: number) => void;
  handleDragStart: (e: React.DragEvent, id: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, index: number) => void;
  handleDragEnd: () => void;
}

const MyHand: React.FC<MyHandProps> = (props) => {
  const {
    handRef, visibleHand, sortedHand, selectedCards, draggedCard, isSorting, cardOffsets,
    showCardDealAnimation, dealtCards, gameMode, handleCardSelect, handleDragStart,
    handleDragOver, handleDragLeave, handleDrop, handleDragEnd
  } = props;

  const dummyGameState = { lastType: 0, lastMadeType: 0, lastHighestValue: 0, currentTurnId: 0, maxNumber: 13, round: 1, totalRounds: 5 };
  const { getDisplayColor, getCardImage } = useCardUtils(dummyGameState, gameMode);

  const handToRender = showCardDealAnimation ? visibleHand : sortedHand;

  if (handToRender.length === 0 && !showCardDealAnimation) {
    return (
      <div className="my-hand loading">
        <div className="loading-text">패를 받고 있습니다...</div>
      </div>
    );
  }

  return (
    <div className={`my-hand ${showCardDealAnimation ? 'dealing' : ''}`} ref={handRef}>
      {handToRender.map((tile, index) => (
        <div 
          key={tile.id} 
          className={`hand-tile ${getDisplayColor(tile.color)} ${selectedCards.includes(tile.id) ? 'selected' : ''} ${draggedCard === tile.id ? 'dragging' : ''} ${isSorting ? 'sorting' : ''} ${showCardDealAnimation ? 'dealing' : ''} ${dealtCards.has(index) ? 'dealt' : ''}`}
          style={isSorting && cardOffsets[tile.id] !== undefined ? {
            transform: `translateX(${cardOffsets[tile.id]}px)`
          } : showCardDealAnimation ? {
            animationDelay: `${index * 0.12}s`
          } : {}}
          onClick={showCardDealAnimation ? undefined : () => handleCardSelect(tile.id)}
          draggable={!isSorting && !showCardDealAnimation}
          onDragStart={showCardDealAnimation ? undefined : (e) => handleDragStart(e, tile.id)}
          onDragOver={showCardDealAnimation ? undefined : (e) => handleDragOver(e, index)}
          onDragLeave={showCardDealAnimation ? undefined : handleDragLeave}
          onDrop={showCardDealAnimation ? undefined : (e) => handleDrop(e, index)}
          onDragEnd={showCardDealAnimation ? undefined : handleDragEnd}
        >
          {showCardDealAnimation && !dealtCards.has(index) ? (
            <div className="card-back-animation" />
          ) : (
            <>
              {getCardImage(getDisplayColor(tile.color)) && (
                <img 
                  src={getCardImage(getDisplayColor(tile.color))!} 
                  alt={getDisplayColor(tile.color)} 
                  className="card-image"
                />
              )}
              <span className="tile-value">{tile.value || '?'}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default MyHand;
