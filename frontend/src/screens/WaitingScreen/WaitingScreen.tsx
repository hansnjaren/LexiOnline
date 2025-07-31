import React, { useState, useEffect, useRef } from 'react';
import { Room } from 'colyseus.js';
import { useNavigate } from 'react-router-dom';
import './WaitingScreen.css';
import ColyseusService from '../../services/ColyseusService';
import Toast from '../../components/Toast/Toast';

interface Player {
  id: string;
  nickname: string;
  isReady: boolean;
  easyMode: boolean;
}

interface WaitingScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
  playerCount: number;
  setPlayerCount: (count: number) => void;
}

// 커스텀 드롭다운 컴포넌트
const CustomDropdown: React.FC<{
  value: number;
  onChange: (value: number) => void;
  options: { value: number; label: string }[];
  disabled?: boolean;
}> = ({ value, onChange, options, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleSelect = (optionValue: number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div 
      ref={dropdownRef}
      className={`custom-dropdown ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <div 
        className="dropdown-header" 
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span>{selectedOption?.label}</span>
        <div className="dropdown-arrow"></div>
      </div>
      {isOpen && (
        <div className="dropdown-options">
          {options.map((option) => (
            <div
              key={option.value}
              className={`dropdown-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WaitingScreen: React.FC<WaitingScreenProps> = ({ onScreenChange, playerCount, setPlayerCount }) => {
  const navigate = useNavigate();
  const roomRef = useRef<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [hostId, setHostId] = useState('');
  const [rounds, setRounds] = useState(3);
  const [easyMode, setEasyMode] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(true);
  const reconnectAttempted = useRef(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const initialize = async () => {
      let room = ColyseusService.getRoom();
      
      if (!room && !reconnectAttempted.current) {
        reconnectAttempted.current = true;
        try {
          const reconnectedRoom = await ColyseusService.reconnectToSavedRoom();
          if (reconnectedRoom) {
            room = reconnectedRoom;
          } else {
            navigate('/');
            onScreenChange('lobby');
            setIsReconnecting(false);
            return;
          }
        } catch (error) {
          console.error('[WaitingScreen] Reconnection error:', error);
          navigate('/');
          onScreenChange('lobby');
          setIsReconnecting(false);
          return;
        }
      }
      
      if (room) {
        roomRef.current = room;
        setupRoomListeners(room);
      } else if (!reconnectAttempted.current) {
        navigate('/');
        onScreenChange('lobby');
      }
      
      setIsReconnecting(false);
    };

    initialize();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupRoomListeners = (room: any) => {
    setRoomCode(room.roomId);

    const loadInitialState = () => {
      const state = room.state;
      if (state.players) {
        const playerList: Player[] = [];
        state.players.forEach((player: any, sessionId: string) => {
          if (player.connected) {
            playerList.push({
              id: sessionId,
              nickname: player.nickname || '익명',
              isReady: player.ready || false,
              easyMode: player.easyMode || false,
            });
          }
        });
        setPlayers(playerList);
      }
      setHostId(state.host);
      if (state.totalRounds !== undefined) {
        setRounds(state.totalRounds);
      }
    };

    loadInitialState();

    room.onStateChange((state: any) => {
      if (state.players) {
        const playerList: Player[] = [];
        state.players.forEach((player: any, sessionId: string) => {
          playerList.push({
            id: sessionId,
            nickname: player.nickname || '익명',
            isReady: player.ready || false,
            easyMode: player.easyMode || false,
          });
        });
        setPlayers(playerList);
        setHostId(state.host);
        if (state.totalRounds !== undefined) {
          setRounds(state.totalRounds);
        }
        if (!state.players.has(room.sessionId)) {
          ColyseusService.disconnect();
          navigate('/');
          onScreenChange('lobby');
        }
      }
    });

    room.onMessage('reconnected', (message: any) => {
      const { roomState } = message;
      const playerList: Player[] = [];
      Object.entries(roomState.players).forEach(([sessionId, player]: [string, any]) => {
        playerList.push({
          id: sessionId,
          nickname: player.nickname || '익명',
          isReady: player.ready || false,
          easyMode: player.easyMode || false,
        });
      });
      setPlayers(playerList);
      setHostId(roomState.host);
      setRounds(roomState.totalRounds);
      const currentPlayer = roomState.players[room.sessionId];
      if (currentPlayer) {
        setIsReady(currentPlayer.ready);
      }
    });

    room.onMessage('gameStarted', () => onScreenChange('game'));
    room.onMessage('gameReset', () => {});
    room.onMessage('roundsChanged', (message: any) => setRounds(message.rounds));
    room.onMessage('totalRoundsUpdated', (message: any) => setRounds(message.totalRounds));
    room.onMessage('changeRejected', (message: any) => alert('라운드 수 변경이 거부되었습니다: ' + message.reason));

    room.onMessage('playerReconnected', (message: any) => {
      console.log('플레이어 재연결:', message);
      if (message.isHost) {
        setHostId(message.playerId);
      }
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.id === message.playerId 
            ? { ...player, nickname: message.nickname }
            : player
        )
      );
    });

    room.onMessage('playersUpdated', (message: any) => {
      const updatedPlayers: Player[] = message.players.map((p: any) => ({
        id: p.playerId,
        nickname: p.nickname,
        isReady: p.isReady,
        easyMode: p.easyMode || false,
      }));
      setPlayers(updatedPlayers);
      
      const hostPlayer = message.players.find((p: any) => p.isHost);
      if (hostPlayer) {
        setHostId(hostPlayer.playerId);
      }

      const currentPlayer = message.players.find((p: any) => p.playerId === room.sessionId);
      if (currentPlayer) {
        setIsReady(currentPlayer.isReady);
      }
    });

    return () => {
      room.onLeave(() => console.log('대기실에서 나갔습니다.'));
    };
  };

  const handleReady = () => {
    const room = ColyseusService.getRoom();
    if (room) {
      const newReadyState = !isReady;
      setIsReady(newReadyState);
      room.send('ready', { ready: newReadyState });
    }
  };

  const handleStartGame = () => {
    const room = roomRef.current;
    if (room && room.sessionId === hostId) {
      room.send('start', { rounds });
    }
  };

  const handleLeaveRoom = () => {
    ColyseusService.disconnect();
    navigate('/');
    onScreenChange('lobby');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setToastMessage('방 코드가 복사되었습니다!');
    setShowToast(true);
  };

  const allPlayersReady = players.length > 0 && players.every(player => player.isReady);
  const isHost = roomRef.current?.sessionId === hostId;

  if (isReconnecting) {
    return (
      <div className="waiting-screen">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p>방에 재연결 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="waiting-screen">
      <Toast 
        message={toastMessage} 
        type="success"
        isVisible={showToast} 
        onClose={() => setShowToast(false)} 
        showCloseButton={false}
        hideBorder={true}
        isCopyNotification={true}
      />
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
          <h2>플레이어 목록 ({players.length}명)</h2>
          <div className="players-list">
            {players.length > 0 ? (
              players.map((player) => (
                <div key={player.id} className="player-item">
                  <span className={`status ${player.easyMode ? 'ready' : 'waiting'}`}>
                    {player.easyMode ? '초보 모드' : '일반 모드'}
                  </span>
                  <span className="nickname">{player.nickname}</span>
                  <span className={`status ${player.isReady ? 'ready' : 'waiting'}`}>
                    {player.isReady ? '준비완료' : '대기중'}
                  </span>
                </div>
              ))
            ) : (
              <div className="no-players">
                <p>플레이어가 없습니다...</p>
              </div>
            )}
          </div>
        </div>

        <div className="game-settings">
          <h2>게임 설정</h2>
          <div className="settings-row">
             <div className="rounds-setting">
               <label htmlFor="rounds">라운드 수:</label>
               {isHost ? (
                 <CustomDropdown
                   value={rounds}
                   onChange={(value) => {
                     setRounds(value);
                     const room = ColyseusService.getRoom();
                     if (room) {
                       room.send('changeRounds', { rounds: value });
                     }
                   }}
                   options={[
                     { value: 1, label: '1라운드' },
                     { value: 2, label: '2라운드' },
                     { value: 3, label: '3라운드' },
                     { value: 4, label: '4라운드' },
                     { value: 5, label: '5라운드' },
                   ]}
                 />
               ) : (
                 <div className="rounds-info">
                   <span className="rounds-text">{rounds}라운드</span>
                 </div>
               )}
             </div>
              <div className="easymode-setting">
              <label>게임 모드:</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="gameMode"
                    value="normal"
                    checked={!easyMode}
                    onChange={() => {
                      const room = ColyseusService.getRoom();
                      if (room) {
                        setEasyMode(false);
                        room.send('easyMode', { easyMode: false });
                      }
                    }}
                  />
                  <span className="radio-custom"></span>
                  <span className="radio-label">일반 모드</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="gameMode"
                    value="easy"
                    checked={easyMode}
                    onChange={() => {
                      const room = ColyseusService.getRoom();
                      if (room) {
                        setEasyMode(true);
                        room.send('easyMode', { easyMode: true });
                      }
                    }}
                  />
                  <span className="radio-custom"></span>
                  <span className="radio-label">초보 모드</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="controls">
          <button 
            className={`btn ${isReady ? 'btn-ready-active' : 'btn-ready'}`} 
            onClick={handleReady}
          >
            {isReady ? '준비 취소' : '준비하기'}
          </button>
          {isHost && allPlayersReady && players.length >= 3 && (
            <button className="btn btn-start" onClick={handleStartGame}>
              게임 시작
            </button>
          )}
          <button className="btn btn-leave" onClick={handleLeaveRoom}>
            방 나가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaitingScreen;
