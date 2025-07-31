import React, { useState, useCallback } from 'react';
import './GameScreen.css';
import '../Toast/Toast.css';
import CombinationGuide from './CombinationGuide';
import GameGuide from './GameGuide';
import CardDealAnimation from './CardDealAnimation';
import OtherPlayers from './OtherPlayers';
import GameBoard from './GameBoard';
import MyHand from './MyHand';
import Controls from './Controls';
import { useGameLogic } from './hooks/useGameLogic';
import ColyseusService from '../../services/ColyseusService';
import Toast from '../Toast/Toast';

type ScreenType = 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult';

interface GameScreenProps {
  onScreenChange: (screen: ScreenType, result?: any) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ onScreenChange }) => {
  const [showCombinationGuide, setShowCombinationGuide] = useState(false);
  const [showGameGuide, setShowGameGuide] = useState(false);
  
  const {
    players, mySessionId, myHand, sortedHand, visibleHand, gameState, gameMode,
    selectedCards, boardCards, boardSize, showCardDealAnimation, dealtCards,
    isGameStarted, waitingForNextRound, readyPlayers, showBoardMask, isSubmitting,
    draggedCard, isSorting, cardOffsets, handRef, isMyTurn, toast, showToast, closeToast,
    
    setDraggedCard, setDealtCards, setVisibleHand,
    
    handleSortByNumber, handleSortByColor, handleDrop, handlePass, handleSubmitCards,
    handleModeChange, handleCardSelect, handleCardDealComplete,
  } = useGameLogic(onScreenChange);

  const handleDragStart = (e: React.DragEvent, cardId: number) => {
    setDraggedCard(cardId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', cardId.toString());
    
    const cardElement = e.currentTarget as HTMLElement;
    const dragImage = cardElement.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '1';
    dragImage.style.transform = 'rotate(5deg) scale(1.1)';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 25, 30);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleActualDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedCard === null) return;
    handleDrop(dropIndex);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverIndex(null);
  };

  const handlePlayerCardReceived = useCallback((playerIndex: number) => {
    // This logic is now handled inside useColyseusEffects, 
    // but we might need it for animation synchronization if problems arise.
  }, []);

  const handleMyCardDealt = useCallback((cardIndex: number) => {
    setDealtCards(prev => new Set(Array.from(prev).concat([cardIndex])));
    setVisibleHand(prev => {
      const card = sortedHand[cardIndex];
      if (card && !prev.find(c => c.id === card.id)) {
        return [...prev, card];
      }
      return prev;
    });
  }, [sortedHand, setDealtCards, setVisibleHand]);

  return (
    <div className="game-screen">
      {showCardDealAnimation && players.length > 0 && (
        <CardDealAnimation
          isVisible={showCardDealAnimation}
          onComplete={handleCardDealComplete}
          playerCount={players.length}
          cardsPerPlayer={myHand.length || 16}
          myPlayerIndex={players.findIndex(p => p.sessionId === mySessionId)}
          myHand={myHand}
          onPlayerCardReceived={handlePlayerCardReceived}
          onMyCardDealt={handleMyCardDealt}
          gameMode={gameMode}
        />
      )}

      {waitingForNextRound && (
        <div className="waiting-popup-overlay">
          <div className="waiting-popup">
            <div className="waiting-spinner"></div>
            <h3>다른 유저들을 기다리는 중입니다...</h3>
            <p>준비 완료: {readyPlayers.size} / {players.length}명</p>
            <div className="ready-list">
              {players.map(player => (
                <span key={player.sessionId} className={`ready-indicator ${readyPlayers.has(player.sessionId) ? 'ready' : 'waiting'}`}>
                  {player.nickname}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="game-container">
        <div className="round-info">
          <span className="round-text">
            라운드 {gameState.round} / {ColyseusService.getRoom()?.state?.totalRounds || gameState.totalRounds}
          </span>
        </div>
        
        <div className="top-left-section">
          <OtherPlayers players={players} mySessionId={mySessionId} />
        </div>

        <GameBoard 
          boardCards={boardCards} 
          boardSize={boardSize} 
          gameMode={gameMode} 
          showBoardMask={showBoardMask} 
        />

        <Controls
          players={players}
          mySessionId={mySessionId}
          isMyTurn={isMyTurn}
          isSubmitting={isSubmitting}
          gameState={gameState}
          gameMode={gameMode}
          sortedHand={sortedHand}
          dealtCards={dealtCards}
          showCardDealAnimation={showCardDealAnimation}
          handleViewCombinations={() => setShowCombinationGuide(true)}
          handleModeChange={handleModeChange}
          handleSubmitCards={handleSubmitCards}
          handlePass={handlePass}
  
          handleSortByNumber={handleSortByNumber}
          handleSortByColor={handleSortByColor}
        >
          <MyHand
            handRef={handRef}
            visibleHand={visibleHand}
            sortedHand={sortedHand}
            selectedCards={selectedCards}
            draggedCard={draggedCard}
            isSorting={isSorting}
            cardOffsets={cardOffsets}
            showCardDealAnimation={showCardDealAnimation}
            dealtCards={dealtCards}
            gameMode={gameMode}
            handleCardSelect={handleCardSelect}
            handleDragStart={handleDragStart}
            handleDragOver={(e, index) => { e.preventDefault(); setDragOverIndex(index); }}
            handleDragLeave={(e) => { e.preventDefault(); setDragOverIndex(null); }}
            handleDrop={handleActualDrop}
            handleDragEnd={handleDragEnd}
          />
        </Controls>
      </div>
      
      <CombinationGuide 
        isOpen={showCombinationGuide}
        onClose={() => setShowCombinationGuide(false)}
        onShowGameGuide={() => setShowGameGuide(true)}
        gameMode={gameMode}
      />
      
      <GameGuide 
        isOpen={showGameGuide}
        onClose={() => setShowGameGuide(false)}
      />
      
      {/* Toast 알림 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={closeToast}
        duration={2000}
        showCloseButton={false}
        className="game-toast"
      />
    </div>
  );
};

export default GameScreen;
