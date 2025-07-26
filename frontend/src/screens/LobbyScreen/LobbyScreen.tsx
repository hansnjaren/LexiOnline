import React, { useState } from 'react';
import './LobbyScreen.css';
import logoImage from '../../logo.png';

interface LobbyScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ onScreenChange }) => {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = () => {
    // 방 생성 로직
    console.log('방 생성:', nickname);
    onScreenChange('waiting');
  };

  const handleJoinRoom = () => {
    // 방 참가 로직
    console.log('방 참가:', nickname, roomCode);
    onScreenChange('waiting');
  };

  return (
    <div className="lobby-screen">
      <div className="lobby-container">
        <div className="logo-section">
          <img src={logoImage} alt="LexiOnline Logo" className="logo-image" />
        </div>
        
        <div className="input-section">
          <div className="input-group">
            <label htmlFor="nickname">닉네임</label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="roomCode">방 코드</label>
            <input
              type="text"
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="방 코드를 입력하세요"
            />
          </div>
        </div>

        <div className="button-section">
          <button 
            className="btn btn-primary" 
            onClick={handleCreateRoom}
            disabled={!nickname}
          >
            방 만들기
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleJoinRoom}
            disabled={!nickname || !roomCode}
          >
            방 참가하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default LobbyScreen; 