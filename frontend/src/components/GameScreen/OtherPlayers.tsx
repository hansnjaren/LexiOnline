import React from 'react';
import { motion } from 'framer-motion';
import { Player } from './types';
import ColyseusService from '../../services/ColyseusService';
import coinImage from '../../coin.png';
import cardImage from '../../card.png';

const AnimatedRemainingTiles: React.FC<{ count: number }> = ({ count }) => {
  // This can be further enhanced with useMotionValue if needed
  return <motion.span>{String(count).padStart(2, '0')}</motion.span>;
};

interface OtherPlayersProps {
  players: Player[];
  mySessionId: string;
}

const OtherPlayers: React.FC<OtherPlayersProps> = ({ players, mySessionId }) => {
  const room = ColyseusService.getRoom();
  const playerOrder = room?.state?.playerOrder || [];
  const nowPlayerIndex = room?.state?.nowPlayerIndex || 0;

  const otherPlayers = players.filter(player => player.sessionId !== mySessionId);
  const sortedOtherPlayers = otherPlayers.sort((a, b) => {
    const aIndex = playerOrder.indexOf(a.sessionId);
    const bIndex = playerOrder.indexOf(b.sessionId);
    const myIndex = playerOrder.indexOf(mySessionId);
    const aRelativeIndex = (aIndex - myIndex + playerOrder.length) % playerOrder.length;
    const bRelativeIndex = (bIndex - myIndex + playerOrder.length) % playerOrder.length;
    return aRelativeIndex - bRelativeIndex;
  });

  return (
    <div className="other-players">
      {sortedOtherPlayers.map((player) => {
        const currentPlayerSessionId = playerOrder[nowPlayerIndex];
        const isCurrentTurn = player.sessionId === currentPlayerSessionId;

        return (
          <div key={player.id} className="player-info-container">
            <div className={`player-info-box ${isCurrentTurn ? 'current-turn' : ''} ${player.hasPassed ? 'passed' : ''}`}>
              <div className="player-info">
                <div className="player-nickname">{player.nickname}</div>
                <div className="player-coins">
                  <img src={coinImage} alt="코인" className="coin-icon" />
                  {player.score}
                </div>
              </div>
              {player.hasPassed && (
                <div className="pass-overlay">
                  <span className="pass-text">PASS</span>
                </div>
              )}
            </div>
            <div className="remaining-tiles-count">
              <img src={cardImage} alt="카드" className="card-icon" />
              <AnimatedRemainingTiles count={player.remainingTiles} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OtherPlayers;
