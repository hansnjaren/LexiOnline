import React, { useState } from 'react';
import './App.css';
import LobbyScreen from './screens/LobbyScreen/LobbyScreen';
import WaitingScreen from './screens/WaitingScreen/WaitingScreen';
import GameScreen from './components/GameScreen/GameScreen';
import ResultScreen from './screens/ResultScreen/ResultScreen';

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
    <div className="App">
      {renderScreen()}
    </div>
  );
}

export default App;
