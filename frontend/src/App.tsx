import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LobbyScreen from './screens/LobbyScreen/LobbyScreen';
import WaitingScreen from './screens/WaitingScreen/WaitingScreen';
import GameScreen from './components/GameScreen/GameScreen';
import ResultScreen from './screens/ResultScreen/ResultScreen';
import GoogleOAuthCallback from './auth/google/callback';

type ScreenType = 'lobby' | 'waiting' | 'game' | 'result';

function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('lobby');

  const handleScreenChange = (screen: ScreenType) => {
    setCurrentScreen(screen);
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

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />
          <Route path="*" element={renderScreen()} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
