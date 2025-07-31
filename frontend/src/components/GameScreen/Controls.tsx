import React from 'react';
import { Player, GameState } from './types';
import coinImage from '../../coin.png';
import cardImage from '../../card.png';
import { useCardUtils } from './hooks/useCardUtils';

interface ControlsProps {
  players: Player[];
  mySessionId: string;
  isMyTurn: boolean;
  isSubmitting: boolean;
  gameState: GameState;
  gameMode: 'easyMode' | 'normal';
  sortedHand: { id: number }[];
  dealtCards: Set<number>;
  showCardDealAnimation: boolean;
  handleViewCombinations: () => void;
  handleModeChange: () => void;
  handleSubmitCards: () => void;
  handlePass: () => void;
  handleSortByNumber: () => void;
  handleSortByColor: () => void;
  children: React.ReactNode;
}

const Controls: React.FC<ControlsProps> = (props) => {
  const {
    players, mySessionId, isMyTurn, isSubmitting, gameState, gameMode, sortedHand, dealtCards,
    showCardDealAnimation, handleViewCombinations, handleModeChange, handleSubmitCards,
    handlePass, handleSortByNumber, handleSortByColor, children
  } = props;

  const { getCurrentCombinationText } = useCardUtils(gameState, gameMode);
  const me = players.find(p => p.sessionId === mySessionId);

  return (
    <div className="bottom-section">
      <div className="bottom-top">
        <div className="my-info">
          <div className={`my-info-box ${isMyTurn ? 'current-turn' : ''} ${me?.hasPassed ? 'passed' : ''}`}>
            <div className="my-nickname">{me?.nickname || '닉네임'}</div>
            <div className="my-stats">
              <span className="my-coins">
                <img src={coinImage} alt="코인" className="coin-icon" />
                {me?.score || 0}
              </span>
              <span className="my-tiles">
                <img src={cardImage} alt="카드" className="card-icon" />
                {String(showCardDealAnimation ? dealtCards.size : sortedHand.length).padStart(2, '0')}
              </span>
            </div>
            {me?.hasPassed && <div className="pass-overlay"><span className="pass-text">PASS</span></div>}
          </div>
        </div>

        <div className="center-controls">
          <div className="current-combination">
            <span>현재 조합: {getCurrentCombinationText()}</span>
          </div>
          <div className="control-buttons">
            <button className="control-btn" onClick={handleViewCombinations} disabled={showCardDealAnimation}>족보보기</button>
            <button className="control-btn" onClick={handleModeChange} disabled={showCardDealAnimation}>
              {gameMode === 'easyMode' ? '초보모드' : '일반모드'}
            </button>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className={`action-btn drop-btn ${!isMyTurn || isSubmitting ? 'disabled' : ''}`} 
            onClick={handleSubmitCards}
            disabled={!isMyTurn || isSubmitting || showCardDealAnimation}
          >
            Submit
          </button>
          <button 
            className={`action-btn pass-btn ${!isMyTurn ? 'disabled' : ''}`}
            onClick={handlePass}
            disabled={!isMyTurn || showCardDealAnimation}
          >
            Pass
          </button>
        </div>
      </div>

      <div className="bottom-bottom">
        {children}
        <div className="sort-buttons">
          <button className="sort-btn" onClick={handleSortByNumber} disabled={showCardDealAnimation}>숫자정렬</button>
          <button className="sort-btn" onClick={handleSortByColor} disabled={showCardDealAnimation}>색상정렬</button>
        </div>
      </div>
    </div>
  );
};

export default Controls;
