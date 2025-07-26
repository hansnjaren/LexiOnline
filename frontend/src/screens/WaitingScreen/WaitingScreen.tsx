import React, { useState, useEffect } from 'react';
import './WaitingScreen.css';

interface Player {
  id: string;
  nickname: string;
  isReady: boolean;
}

interface WaitingScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
}

const WaitingScreen: React.FC<WaitingScreenProps> = ({ onScreenChange }) => {
  const [players] = useState<Player[]>([
    { id: '1', nickname: '플레이어1', isReady: true },
    { id: '2', nickname: '플레이어2', isReady: false },
    { id: '3', nickname: '플레이어3', isReady: false },
    { id: '4', nickname: '플레이어4', isReady: false },
  ]);
  const [roomCode] = useState('ABC123');
  const [rounds, setRounds] = useState(3);

  const handleReady = () => {
    // 준비 상태 토글 로직 (백엔드 연동 시 Colyseus로 변경 예정)
    console.log('준비 상태 변경');
    // 임시로 바로 게임 화면으로 이동
    onScreenChange('game');
  };

  const handleStartGame = () => {
    // 게임 시작 로직 (백엔드 연동 시 Colyseus로 변경 예정)
    console.log('게임 시작');
    onScreenChange('game');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert('방 코드가 복사되었습니다!');
  };

  const allPlayersReady = players.every(player => player.isReady);

  return (
    <div className="waiting-screen">
      <div className="waiting-container">
        <div className="header">
          <h1>게임 대기실</h1>
          <div className="room-info">
            <span>방 코드: {roomCode}</span>
            <button className="copy-btn" onClick={copyRoomCode}>
              복사
            </button>
          </div>
        </div>

        <div className="players-section">
          <h2>플레이어 목록</h2>
          <div className="players-list">
            {players.map((player) => (
              <div key={player.id} className="player-item">
                <span className="nickname">{player.nickname}</span>
                <span className={`status ${player.isReady ? 'ready' : 'waiting'}`}>
                  {player.isReady ? '준비완료' : '대기중'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="game-settings">
          <h2>게임 설정</h2>
          <div className="rounds-setting">
            <label htmlFor="rounds">라운드 수:</label>
            <select 
              id="rounds" 
              value={rounds} 
              onChange={(e) => setRounds(Number(e.target.value))}
            >
              <option value={1}>1라운드</option>
              <option value={2}>2라운드</option>
              <option value={3}>3라운드</option>
              <option value={4}>4라운드</option>
              <option value={5}>5라운드</option>
            </select>
          </div>
        </div>

        <div className="controls">
          <button className="btn btn-ready" onClick={handleReady}>
            준비하기
          </button>
          {allPlayersReady && (
            <button className="btn btn-start" onClick={handleStartGame}>
              게임 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitingScreen; 