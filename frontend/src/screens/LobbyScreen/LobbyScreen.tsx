import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LobbyScreen.css';
import logoImage from '../../logo.png';
import { User } from '../../../../shared/models/User'
import { GameHistory } from '../../../../shared/models/GameHistory'

interface LobbyScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
}

const LobbyScreen: React.FC<LobbyScreenProps> = ({ onScreenChange }) => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('access_token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    fetch('https://34.47.120.134:2567/api/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          console.error('Failed to fetch user info:', res.status, text);
          throw new Error('유저 정보 가져오기 실패');
        }
        return res.json();
      })
      .then(data => {
        console.log('User data received:', data);
        setUser(data.user);
        if (data.user.nickname) setNickname(data.user.nickname);
      })
      .catch(err => {
        console.error(err);
        setUser(null);
        setToken(null);
        sessionStorage.removeItem('access_token');
        navigate('/login');
      });
  }, [token, navigate]);

  const handleCreateRoom = () => {
    // 방 생성 로직
    console.log('방 생성:', nickname);
    navigate('/waiting');
  };

  const handleJoinRoom = () => {
    // 방 참가 로직
    console.log('방 참가:', nickname, roomCode);
    navigate('/waiting');
  };

  const handleLogin = () => {
    const state = Math.random().toString(36).substring(2);
    const nonce = Math.random().toString(36).substring(2);
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_nonce', nonce);

    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID!;
    const redirectUri = process.env.REACT_APP_GOOGLE_REDIRECT_URI!;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=id_token` +
      `&scope=${encodeURIComponent('profile email')}` +
      `&state=${encodeURIComponent(state)}` +
      `&nonce=${encodeURIComponent(nonce)}` +
      `&prompt=select_account`;

    window.location.href = authUrl;
  };

  const handleLogout = () => {
    sessionStorage.removeItem('access_token'); // 토큰 삭제
    setToken(null);
    setUser(null);
    // 필요하다면: onScreenChange('lobby'); 등으로 초기화 or navigate('/')
  };


  return (
    <div className="lobby-screen">
      {token ? (
        <div style={{ width: 300 }}>
          <div>
            <strong>Access Token:</strong>
            <div style={{ wordBreak: 'break-all' }}>{token}</div>
          </div>

          {user ? (
            <div style={{ marginTop: 12 }}>
              <h3>사용자 정보</h3>
              <p><strong>이름:</strong> {user.nickname || '-'}</p>
              <p><strong>레이팅:</strong> {user.rating_mu || '-'}</p>
              <p><strong>신뢰도:</strong> {user.rating_sigma || '-'}</p>
              {user.profileImageUrl && (
                <img src={user.profileImageUrl} alt="profile" width={80} height={80} style={{ borderRadius: '50%' }} />
              )}
            </div>
          ) : (
            <p>사용자 정보를 가져오는 중...</p>
          )}

          <button onClick={handleLogout} style={{ marginTop: 12 }}>
            로그아웃
          </button>
        </div>
      ) : (
        <button onClick={handleLogin}>Google Login</button>
      )}
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
