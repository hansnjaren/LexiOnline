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
}

interface WaitingScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
  playerCount: number;
  setPlayerCount: (count: number) => void;
}

const WaitingScreen: React.FC<WaitingScreenProps> = ({ onScreenChange, playerCount, setPlayerCount }) => {
  const navigate = useNavigate();
  const roomRef = useRef<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [hostId, setHostId] = useState('');
  const [rounds, setRounds] = useState(3);
  const [isReady, setIsReady] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    console.log(`[WaitingScreen] useEffect triggered. Current time: ${new Date().toLocaleTimeString()}`);
    let room = ColyseusService.getRoom();
    roomRef.current = room;
    
    // 방에 연결되지 않은 경우, 저장된 방 정보로 재연결 시도
    if (!room) {
      console.log(`[WaitingScreen] No room instance found. Attempting to reconnect...`);
      setIsReconnecting(true);
      ColyseusService.reconnectToSavedRoom().then(reconnectedRoom => {
        setIsReconnecting(false);
        if (reconnectedRoom) {
          roomRef.current = reconnectedRoom;
          console.log(`[WaitingScreen] Reconnection successful. Room ID: ${reconnectedRoom.roomId}`);
          setupRoomListeners(reconnectedRoom);
        } else {
          console.log(`[WaitingScreen] Reconnection failed. Navigating to lobby.`);
          // URL을 루트로 변경
          navigate('/');
          onScreenChange('lobby');
        }
      });
      return;
    }

    setupRoomListeners(room);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupRoomListeners = (room: any) => {
    // 방 코드는 roomId를 사용 (실제 방 참가에 사용 가능한 코드)
    setRoomCode(room.roomId);

    // 초기 상태 로드
    const loadInitialState = () => {
      const state = room.state;
      console.log('초기 방 상태:', state);
      
      if (state.players) {
        const playerList: Player[] = [];
        const seenIds = new Set<string>();
        
        state.players.forEach((player: any, sessionId: string) => {
          // 중복 체크
          if (seenIds.has(sessionId)) {
            console.log('중복 플레이어 ID 발견:', sessionId);
            return;
          }
          seenIds.add(sessionId);
          
          playerList.push({
            id: sessionId,
            nickname: player.nickname || '익명',
            isReady: player.ready || false
          });
        });
        setPlayers(playerList);
        console.log('플레이어 목록 업데이트:', playerList);
      }
      
      // 호스트 확인
      setHostId(state.host);
      console.log(`호스트 여부: ${state.host} === ${room.sessionId} -> ${state.host === room.sessionId}`);
    };

    // 초기 상태 로드
    loadInitialState();

    // 방 상태 구독
    room.onStateChange((state: any) => {
      console.log('방 상태 변경:', state);
      if (state.players) {
        const playerList: Player[] = [];
        const seenIds = new Set<string>();
        
        state.players.forEach((player: any, sessionId: string) => {
          // 중복 체크
          if (seenIds.has(sessionId)) {
            console.log('중복 플레이어 ID 발견:', sessionId);
            return;
          }
          seenIds.add(sessionId);
          
          playerList.push({
            id: sessionId,
            nickname: player.nickname || '익명',
            isReady: player.ready || false
          });
        });
        setPlayers(playerList);
        
        // 호스트 확인
        setHostId(state.host);
      }
    });

    // 메시지 수신
    room.onMessage('gameStarted', () => {
      console.log('게임이 시작되었습니다!');
      onScreenChange('game');
    });

    room.onMessage('readyUpdate', (message: any) => {
      console.log('준비 상태 업데이트:', message);
      // 준비 상태 업데이트 시 플레이어 목록도 업데이트
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.id === message.playerId 
            ? { ...player, isReady: message.ready }
            : player
        )
      );
      
      // 자신의 준비 상태도 업데이트
      if (message.playerId === room.sessionId) {
        setIsReady(message.ready);
      }
    });

    room.onMessage('gameReset', () => {
      console.log('게임이 리셋되었습니다.');
    });

    room.onMessage('nicknameUpdate', (message: any) => {
      console.log('닉네임 업데이트:', message);
      // 닉네임 업데이트 시 플레이어 목록도 업데이트
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.id === message.playerId 
            ? { ...player, nickname: message.nickname }
            : player
        )
      );
    });

    room.onMessage('roundsChanged', (message: any) => {
      console.log('라운드 수 변경:', message);
      setRounds(message.rounds);
    });

    room.onMessage('changeRejected', (message: any) => {
      console.error('라운드 수 변경 거부:', message.reason);
      alert('라운드 수 변경이 거부되었습니다: ' + message.reason);
    });

    room.onMessage('playerJoined', (message: any) => {
      console.log('새 플레이어 입장:', message);
      // 새 플레이어 추가 (중복 체크)
      setPlayers(prevPlayers => {
        const existingPlayer = prevPlayers.find(p => p.id === message.playerId);
        if (existingPlayer) {
          console.log('이미 존재하는 플레이어입니다:', message.playerId);
          return prevPlayers;
        }
        return [
          ...prevPlayers,
          {
            id: message.playerId,
            nickname: message.nickname,
            isReady: false
          }
        ];
      });
    });

    room.onMessage('playerReconnected', (message: any) => {
      console.log('플레이어 재연결:', message);
      // 재연결된 플레이어는 목록에 추가하지 않음 (이미 존재함)
      // 하지만 닉네임이 업데이트되었을 수 있으므로 업데이트
      setPlayers(prevPlayers => 
        prevPlayers.map(player => 
          player.id === message.playerId 
            ? { ...player, nickname: message.nickname }
            : player
        )
      );
    });

    room.onMessage('playerLeft', (message: any) => {
      console.log('플레이어 퇴장:', message);
      // 퇴장한 플레이어 제거
      setPlayers(prevPlayers => 
        prevPlayers.filter(player => player.id !== message.playerId)
      );
    });

    // 방에서 나갈 때 정리
    return () => {
      room.onLeave(() => {
        console.log('대기실에서 나갔습니다.');
      });
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
    // URL을 루트로 변경
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

  // 재연결 중일 때 로딩 화면 표시
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

        {/* 게임 설정 - 호스트에게만 표시 */}
        {isHost && (
          <div className="game-settings">
            <h2>게임 설정</h2>
            <div className="rounds-setting">
              <label htmlFor="rounds">라운드 수:</label>
              <select 
                id="rounds" 
                value={rounds} 
                onChange={(e) => {
                  const newRounds = Number(e.target.value);
                  setRounds(newRounds);
                  // 서버에 라운드 수 변경 요청
                  const room = ColyseusService.getRoom();
                  if (room) {
                    room.send('changeRounds', { rounds: newRounds });
                  }
                }}
              >
                <option value={1}>1라운드</option>
                <option value={2}>2라운드</option>
                <option value={3}>3라운드</option>
                <option value={4}>4라운드</option>
                <option value={5}>5라운드</option>
              </select>
            </div>
          </div>
        )}

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
