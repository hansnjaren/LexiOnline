import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import LobbyScreen from './screens/LobbyScreen/LobbyScreen';
import WaitingScreen from './screens/WaitingScreen/WaitingScreen';
import GameScreen from './components/GameScreen/GameScreen';
import ResultScreen from './screens/ResultScreen/ResultScreen';
import GoogleOAuthCallback from './auth/google/callback';

type ScreenType = 'lobby' | 'waiting' | 'game' | 'result';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('lobby');

  // URL 경로에 따라 화면 상태 설정
  useEffect(() => {
    const path = location.pathname;
    if (path === '/waiting') {
      setCurrentScreen('waiting');
    } else if (path === '/game') {
      setCurrentScreen('game');
    } else if (path === '/result') {
      setCurrentScreen('result');
    } else {
      setCurrentScreen('lobby');
    }
  }, [location.pathname]);

  const handleScreenChange = (screen: ScreenType) => {
    setCurrentScreen(screen);
    // 화면 변경 시 URL도 업데이트
    switch (screen) {
      case 'waiting':
        navigate('/waiting');
        break;
      case 'game':
        navigate('/game');
        break;
      case 'result':
        navigate('/result');
        break;
      default:
        navigate('/');
        break;
    }
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'lobby':
        return <LobbyScreen onScreenChange={handleScreenChange} />;
      case 'waiting':
        return <WaitingScreen onScreenChange={handleScreenChange} />;
      case 'game':
        return <GameScreen onScreenChange={handleScreenChange} />;
      case 'result':
        return <ResultScreen onScreenChange={handleScreenChange} />;
      default:
        return <LobbyScreen onScreenChange={handleScreenChange} />;
    }
  };

  return renderScreen();
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
