import React, { useState, useEffect } from 'react';
import './GameScreen.css';
import coinImage from '../../coin.png';
import cardImage from '../../card.png';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';
import CombinationGuide from './CombinationGuide';
import GameGuide from './GameGuide';

interface GameScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
}

interface Player {
  id: string;
  nickname: string;
  coinCount: number;
  remainingTiles: number;
  isCurrentPlayer: boolean;
}

const GameScreen: React.FC<GameScreenProps> = ({ onScreenChange }) => {
  const [currentCombination, setCurrentCombination] = useState<string>('');
  const [gameMode, setGameMode] = useState<'beginner' | 'normal'>('beginner');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [boardCards, setBoardCards] = useState<Array<{
    id: number;
    value: number;
    color: string;
    isNew: boolean;
    row: number;
    col: number;
  }>>([]);
  const [sortedHand, setSortedHand] = useState<Array<{
    id: number;
    value: number;
    color: string;
  }>>([]);
  const [boardSize, setBoardSize] = useState({ rows: 4, cols: 15 });
  const [showCombinationGuide, setShowCombinationGuide] = useState(false);
  const [showGameGuide, setShowGameGuide] = useState(false);
  
  // 플레이어 정보 (이미지에 맞게 수정)
  const players: Player[] = [
    { id: '1', nickname: '닉네임', coinCount: 12, remainingTiles: 8, isCurrentPlayer: false },
    { id: '2', nickname: '닉네임', coinCount: 15, remainingTiles: 12, isCurrentPlayer: false },
    { id: '3', nickname: '닉네임', coinCount: 8, remainingTiles: 15, isCurrentPlayer: false },
    { id: '4', nickname: '닉네임', coinCount: 20, remainingTiles: 10, isCurrentPlayer: true },
  ];

  // 카드 색상 매핑 (초보모드 ↔ 일반모드)
  const colorMapping = {
    'gold': 'sun',    // 금색 ↔ 태양 (빨강)
    'silver': 'moon', // 은색 ↔ 달 (초록)
    'bronze': 'star', // 동색 ↔ 별 (노랑)
    'black': 'cloud'  // 검정색 ↔ 구름 (파랑)
  };

  // 모드에 따른 카드 색상 결정 (게임 시작 시 한 번만)
  const getCardColor = () => {
    return ['gold', 'silver', 'bronze', 'black'][Math.floor(Math.random() * 4)];
  };

  // 현재 모드에 맞는 카드 색상 반환
  const getDisplayColor = (originalColor: string, mode: 'beginner' | 'normal') => {
    if (mode === 'beginner') {
      return originalColor;
    } else {
      return colorMapping[originalColor as keyof typeof colorMapping] || originalColor;
    }
  };

  // 카드 색상에 따른 이미지 반환
  const getCardImage = (color: string) => {
    switch (color) {
      case 'sun':
        return sunImage;
      case 'moon':
        return moonImage;
      case 'star':
        return starImage;
      case 'cloud':
        return cloudImage;
      default:
        return null;
    }
  };

  // 내 손패 (16개 - 이미지에 맞게)
  const [myHand] = useState(() => 
    Array.from({ length: 16 }, (_, index) => ({
      id: index,
      value: Math.floor(Math.random() * 13) + 1,
      color: getCardColor()
    }))
  );

  // 정렬된 손패 초기화
  useEffect(() => {
    setSortedHand([...myHand]);
  }, [myHand]);

  const handleGameEnd = () => {
    console.log('게임 종료');
    onScreenChange('result');
  };

  const handleCardSelect = (cardId: number) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleDrop = () => {
    if (selectedCards.length === 0) return;
    
    // 기존 카드들의 isNew를 false로 변경
    setBoardCards(prev => prev.map(card => ({ ...card, isNew: false })));
    
    // 새로운 카드들을 보드에 추가
    const newCards = selectedCards.map((cardId, index) => {
      const card = sortedHand.find(c => c.id === cardId);
      if (!card) return null;
      
      return {
        ...card,
        isNew: true,
        row: -1, // 임시 값, 나중에 계산
        col: -1  // 임시 값, 나중에 계산
      };
    }).filter((card): card is NonNullable<typeof card> => card !== null);
    
    // 랜덤 위치 찾기 (기존 카드들과 겹치지 않는)
    const findRandomPosition = () => {
      const attempts = 100; // 최대 시도 횟수
      
      for (let attempt = 0; attempt < attempts; attempt++) {
        // 랜덤 행 선택 (현재 보드 크기에 맞춤)
        const randomRow = Math.floor(Math.random() * boardSize.rows);
        
        // 해당 행에서 가능한 모든 시작 위치 찾기
        const possiblePositions = [];
        
        for (let startCol = 0; startCol <= boardSize.cols - newCards.length; startCol++) {
          let canPlace = true;
          
          // 연속된 공간이 비어있는지 확인
          for (let i = 0; i < newCards.length; i++) {
            const col = startCol + i;
            if (col >= boardSize.cols) {
              canPlace = false;
              break;
            }
            
            // 해당 위치에 카드가 있는지 확인
            const existingCard = boardCards.find(c => c.row === randomRow && c.col === col);
            if (existingCard) {
              canPlace = false;
              break;
            }
            
            // 좌우 한 칸 여백 확인
            const leftCard = boardCards.find(c => c.row === randomRow && c.col === col - 1);
            const rightCard = boardCards.find(c => c.row === randomRow && c.col === col + newCards.length);
            
            // 기존 카드와 가로로 이어지는지 확인
            const hasAdjacentCard = boardCards.some(c => 
              c.row === randomRow && 
              (c.col >= startCol - 1 && c.col <= startCol + newCards.length)
            );
            
            if (leftCard || rightCard || hasAdjacentCard) {
              canPlace = false;
              break;
            }
          }
          
          if (canPlace) {
            possiblePositions.push(startCol);
          }
        }
        
        // 가능한 위치가 있으면 랜덤하게 선택
        if (possiblePositions.length > 0) {
          const randomStartCol = possiblePositions[Math.floor(Math.random() * possiblePositions.length)];
          
          // 위치 할당
          newCards.forEach((card, index) => {
            card.row = randomRow;
            card.col = randomStartCol + index;
          });
          return true;
        }
      }
      
      // 적절한 위치를 찾지 못한 경우, 마지막 행에 배치 시도
      const lastRow = Math.min(boardSize.rows - 1, Math.max(...boardCards.map(c => c.row)) + 1);
      
      // 마지막 행에도 공간이 있는지 확인
      let canPlaceInLastRow = true;
      for (let i = 0; i < newCards.length; i++) {
        const existingCard = boardCards.find(c => c.row === lastRow && c.col === i);
        if (existingCard) {
          canPlaceInLastRow = false;
          break;
        }
      }
      
      if (canPlaceInLastRow) {
        newCards.forEach((card, index) => {
          card.row = lastRow;
          card.col = index;
        });
        return true;
      }
      
      return false;
    };
    
    // 여백 압축 및 배치 함수
    const compressAndPlace = () => {
      // 각 행별로 카드 그룹들을 찾기
      const rowGroups: { [row: number]: Array<{ start: number; end: number; cards: any[] }> } = {};
      
      // 각 행에서 연속된 카드 그룹들을 찾기
      for (let row = 0; row < boardSize.rows; row++) {
        const rowCards = boardCards.filter(c => c.row === row).sort((a, b) => a.col - b.col);
        const groups: Array<{ start: number; end: number; cards: any[] }> = [];
        
        if (rowCards.length > 0) {
          let currentGroup = [rowCards[0]];
          let currentStart = rowCards[0].col;
          
          for (let i = 1; i < rowCards.length; i++) {
            if (rowCards[i].col === rowCards[i-1].col + 1) {
              // 연속된 카드
              currentGroup.push(rowCards[i]);
            } else {
              // 새로운 그룹 시작
              groups.push({
                start: currentStart,
                end: rowCards[i-1].col,
                cards: [...currentGroup]
              });
              currentGroup = [rowCards[i]];
              currentStart = rowCards[i].col;
            }
          }
          
          // 마지막 그룹 추가
          groups.push({
            start: currentStart,
            end: rowCards[rowCards.length - 1].col,
            cards: [...currentGroup]
          });
        }
        
        rowGroups[row] = groups;
      }
      
      // 여백이 2칸 이상인 그룹들을 1칸으로 압축
      let totalCompressedSpace = 0;
      const compressedCards: any[] = [];
      
      for (let row = 0; row < boardSize.rows; row++) {
        const groups = rowGroups[row];
        if (!groups || groups.length === 0) continue;
        
        let newCol = 0;
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const groupLength = group.end - group.start + 1;
          
          // 이전 그룹과의 여백 계산
          const prevGroupEnd = i > 0 ? groups[i-1].end : -1;
          const currentGap = group.start - prevGroupEnd - 1;
          
          // 여백이 2칸 이상이면 1칸으로 압축 (다른 턴 카드들 사이에는 최소 1칸 여백 유지)
          const compressedGap = currentGap > 1 ? 1 : currentGap;
          const spaceSaved = currentGap - compressedGap;
          totalCompressedSpace += spaceSaved;
          
          // 카드들의 새로운 위치 계산
          const newStart = newCol + (i > 0 ? compressedGap : 0);
          group.cards.forEach((card, index) => {
            compressedCards.push({
              ...card,
              col: newStart + index
            });
          });
          
          newCol = newStart + groupLength;
        }
      }
      
      // 압축된 공간이 새로운 카드들을 넣을 수 있는지 확인
      if (totalCompressedSpace >= newCards.length) {
        // 압축된 카드들로 보드 업데이트
        setBoardCards(compressedCards);
        
        // 새로운 카드들을 첫 번째 빈 공간에 배치
        for (let row = 0; row < boardSize.rows; row++) {
          const rowCards = compressedCards.filter(c => c.row === row).sort((a, b) => a.col - b.col);
          
          // 빈 공간 찾기
          for (let col = 0; col <= boardSize.cols - newCards.length; col++) {
            let canPlace = true;
            
            // 해당 위치에 카드가 있는지 확인
            for (let i = 0; i < newCards.length; i++) {
              const existingCard = rowCards.find(c => c.col === col + i);
              if (existingCard) {
                canPlace = false;
                break;
              }
            }
            
            if (canPlace) {
              // 기존 카드들과의 여백 확인
              const leftCard = rowCards.find(c => c.col === col - 1);
              const rightCard = rowCards.find(c => c.col === col + newCards.length);
              
              // 좌우에 기존 카드가 있으면 여백이 있어야 함
              if (leftCard || rightCard) {
                continue; // 이 위치는 사용할 수 없음
              }
              
              // 새로운 카드들 배치
              newCards.forEach((card, index) => {
                card.row = row;
                card.col = col + index;
              });
              return true;
            }
          }
        }
      }
      
      return false;
    };
    
    const success = findRandomPosition();
    
    // 위치를 찾지 못한 경우 보드 확장
    if (!success && boardSize.rows === 4 && boardSize.cols === 15) {
      setBoardSize({ rows: 5, cols: 20 });
      // 확장 후 다시 위치 찾기 시도
      setTimeout(() => {
        const retrySuccess = findRandomPosition();
        if (retrySuccess) {
          setBoardCards(prev => [...prev, ...newCards]);
        }
      }, 100);
    } else if (!success && boardSize.rows === 5 && boardSize.cols === 20) {
      // 20x5에서도 실패한 경우, 여백 압축 시도
      const compressedSuccess = compressAndPlace();
      if (compressedSuccess) {
        setBoardCards(prev => [...prev, ...newCards]);
      }
    } else if (success) {
      setBoardCards(prev => [...prev, ...newCards]);
    }
    
    setSelectedCards([]);
  };

  const handlePass = () => {
    console.log('Pass 액션');
  };

  const handleSortByNumber = () => {
    const sorted = [...sortedHand].sort((a, b) => a.value - b.value);
    setSortedHand(sorted);
  };

  const handleSortByColor = () => {
    const colorOrder = gameMode === 'beginner' 
      ? ['gold', 'silver', 'bronze', 'black']
      : ['sun', 'moon', 'star', 'cloud'];
    const sorted = [...sortedHand].sort((a, b) => {
      const aDisplayColor = getDisplayColor(a.color, gameMode);
      const bDisplayColor = getDisplayColor(b.color, gameMode);
      const aIndex = colorOrder.indexOf(aDisplayColor);
      const bIndex = colorOrder.indexOf(bDisplayColor);
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      // 같은 색상 내에서는 숫자 순으로 정렬
      return a.value - b.value;
    });
    setSortedHand(sorted);
  };

  const handleViewCombinations = () => {
    setShowCombinationGuide(true);
  };

  const handleModeChange = () => {
    const newMode = gameMode === 'beginner' ? 'normal' : 'beginner';
    setGameMode(newMode);
    // 카드 색상은 고정되어 있으므로 변경하지 않음
  };

  return (
    <div className="game-screen">
      <div className="game-container">
        {/* 상단 좌측 - 다른 플레이어 정보 */}
        <div className="top-left-section">
          <div className="other-players">
            {players.slice(0, 4).map((player, index) => (
              <div key={player.id} className="player-info-container">
                <div className="player-info-box">
                  <div className="player-info">
                    <div className="player-nickname">{player.nickname}</div>
                    <div className="player-coins">
                      <img src={coinImage} alt="코인" className="coin-icon" />
                      코인수
                    </div>
                  </div>
                </div>
                <div className="remaining-tiles-count">
                  <img src={cardImage} alt="카드" className="card-icon" />
                  {String(player.remainingTiles).padStart(2, '0')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 중앙 - 게임 보드 */}
        <div className="game-board-section">
          <div 
            className="game-board"
            style={{ '--board-cols': boardSize.cols } as React.CSSProperties}
          >
            {Array.from({ length: boardSize.rows }, (_, rowIndex) => (
              <div key={rowIndex} className="board-row">
                {Array.from({ length: boardSize.cols }, (_, colIndex) => {
                  const card = boardCards.find(c => c.row === rowIndex && c.col === colIndex);
                  return (
                    <div key={colIndex} className="board-slot">
                      {card && (
                        <div className={`board-card ${getDisplayColor(card.color, gameMode)} ${card.isNew ? 'new-card' : ''}`}>
                          {getCardImage(getDisplayColor(card.color, gameMode)) && (
                            <img 
                              src={getCardImage(getDisplayColor(card.color, gameMode))!} 
                              alt={getDisplayColor(card.color, gameMode)} 
                              className="card-image"
                            />
                          )}
                          <span className="card-value">{card.value}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 - 내 정보 및 컨트롤 */}
        <div className="bottom-section">
          {/* 하단 상단 - 내 정보 및 컨트롤 */}
          <div className="bottom-top">
            {/* 좌측 - 내 정보 */}
            <div className="my-info">
              <div className="my-info-box">
                <div className="my-nickname">닉네임</div>
                <div className="my-stats">
                  <span className="my-coins">
                    <img src={coinImage} alt="코인" className="coin-icon" />
                    코인수
                  </span>
                  <span className="my-tiles">
                    <img src={cardImage} alt="카드" className="card-icon" />
                    남은패
                  </span>
                </div>
              </div>
            </div>

            {/* 중앙 - 현재 조합 및 버튼들 */}
            <div className="center-controls">
              <div className="current-combination">
                <span>현재 조합</span>
              </div>
              <div className="control-buttons">
                <button className="control-btn" onClick={handleViewCombinations}>
                  족보보기
                </button>
                <button className="control-btn" onClick={handleModeChange}>
                  {gameMode === 'beginner' ? '초보모드' : '일반모드'}
                </button>
              </div>
            </div>

            {/* 우측 - Drop/Pass 버튼 */}
            <div className="action-buttons">
              <button className="action-btn drop-btn" onClick={handleDrop}>
                Submit
              </button>
              <button className="action-btn pass-btn" onClick={handlePass}>
                Pass
              </button>
            </div>
          </div>

          {/* 하단 하단 - 내 손패 및 정렬 버튼 */}
          <div className="bottom-bottom">
            {/* 내 손패 */}
            <div className="my-hand">
              {sortedHand.map((tile) => (
                <div 
                  key={tile.id} 
                  className={`hand-tile ${getDisplayColor(tile.color, gameMode)} ${selectedCards.includes(tile.id) ? 'selected' : ''}`}
                  onClick={() => handleCardSelect(tile.id)}
                >
                  {getCardImage(getDisplayColor(tile.color, gameMode)) && (
                    <img 
                      src={getCardImage(getDisplayColor(tile.color, gameMode))!} 
                      alt={getDisplayColor(tile.color, gameMode)} 
                      className="card-image"
                    />
                  )}
                  <span className="tile-value">{tile.value}</span>
                </div>
              ))}
            </div>
            {/* 정렬 버튼들 */}
            <div className="sort-buttons">
              <button className="sort-btn" onClick={handleSortByNumber}>
                숫자정렬
              </button>
              <button className="sort-btn" onClick={handleSortByColor}>
                모양정렬
              </button>
            </div>
          </div>
        </div>

        {/* 테스트용 게임 종료 버튼 */}
        <button 
          className="test-end-btn" 
          onClick={handleGameEnd}
        >
          게임 종료 (테스트)
        </button>
      </div>
      
      {/* 족보 가이드 모달 */}
      <CombinationGuide 
        isOpen={showCombinationGuide}
        onClose={() => setShowCombinationGuide(false)}
        onShowGameGuide={() => setShowGameGuide(true)}
      />
      
      {/* 게임 가이드북 모달 */}
      <GameGuide 
        isOpen={showGameGuide}
        onClose={() => setShowGameGuide(false)}
      />
    </div>
  );
};

export default GameScreen; 