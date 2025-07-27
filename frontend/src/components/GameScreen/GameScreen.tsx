import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import './GameScreen.css';
import coinImage from '../../coin.png';
import cardImage from '../../card.png';
import sunImage from '../../sun.png';
import moonImage from '../../moon.png';
import starImage from '../../star.png';
import cloudImage from '../../cloud.png';
import CombinationGuide from './CombinationGuide';
import GameGuide from './GameGuide';
import CardDealAnimation from './CardDealAnimation';

interface GameScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
  playerCount: number;
}

interface Player {
  id: string;
  nickname: string;
  coinCount: number;
  remainingTiles: number;
  isCurrentPlayer: boolean;
}

// 애니메이션된 남은 패 개수 컴포넌트
const AnimatedRemainingTiles: React.FC<{ count: number }> = ({ count }) => {
  const countMotion = useMotionValue(0);
  const displayCount = useTransform(countMotion, (value: number) => 
    String(Math.round(value)).padStart(2, '0')
  );

  useEffect(() => {
    countMotion.set(count);
  }, [count, countMotion]);

  return (
    <motion.span>
      {displayCount}
    </motion.span>
  );
};

const GameScreen: React.FC<GameScreenProps> = ({ onScreenChange, playerCount }) => {
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
  
  // 카드 분배 애니메이션 관련 상태
  const [showCardDealAnimation, setShowCardDealAnimation] = useState(true);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [dealtCards, setDealtCards] = useState<Set<number>>(new Set());
  const [visibleHand, setVisibleHand] = useState<Array<{
    id: number;
    value: number;
    color: string;
  }>>([]);
  
  // 드래그 앤 드롭 관련 상태
  const [draggedCard, setDraggedCard] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [cardOffsets, setCardOffsets] = useState<{ [key: number]: number }>({});
  const handRef = useRef<HTMLDivElement>(null);
  
  // 대기 중인 패 저장 (공간 부족으로 제출하지 못한 패)
  const [pendingCards, setPendingCards] = useState<Array<{
    id: number;
    value: number;
    color: string;
  }>>([]);
  
  // 플레이어 정보 (플레이어 수에 따라 동적 생성)
  const [players, setPlayers] = useState<Player[]>(() => {
    const playerArray: Player[] = [];
    for (let i = 1; i <= playerCount; i++) {
      playerArray.push({
        id: i.toString(),
        nickname: '닉네임',
        coinCount: Math.floor(Math.random() * 20) + 5,
        remainingTiles: 0,
        isCurrentPlayer: i === playerCount // 마지막 플레이어가 나
      });
    }
    return playerArray;
  });

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
    if (!showCardDealAnimation) {
      setSortedHand([...myHand]);
    }
  }, [myHand, showCardDealAnimation]);

  const handleGameEnd = () => {
    console.log('게임 종료');
    onScreenChange('result');
  };

  const handleCardDealComplete = () => {
    setShowCardDealAnimation(false);
    setIsGameStarted(true);
    setDealtCards(new Set());
    setVisibleHand([...myHand]); // 모든 카드를 visibleHand에 설정
    
    // 게임 시작 시 플레이어들의 남은 패 개수를 모두 16으로 설정
    setPlayers(prev => prev.map((player, index) => ({
      ...player,
      remainingTiles: 16
    })));
    
    // 손패를 정렬된 상태로 설정
    setSortedHand([...myHand]);
  };

  const handleMyCardDealt = (cardIndex: number) => {
    setDealtCards(prev => new Set(Array.from(prev).concat([cardIndex])));
    // 카드가 분배될 때마다 실시간으로 visibleHand에 추가
    setVisibleHand(prev => {
      const card = sortedHand[cardIndex];
      if (card && !prev.find(c => c.id === card.id)) {
        return [...prev, card];
      }
      return prev;
    });
  };

  // 카드 분배 애니메이션 완료 후 dealt 상태로 변경
  useEffect(() => {
    if (showCardDealAnimation) {
      const timers: NodeJS.Timeout[] = [];
      
      sortedHand.forEach((_, index) => {
        const timer = setTimeout(() => {
          handleMyCardDealt(index);
        }, (index + 1) * 120 + 600); // 애니메이션 delay + duration
        
        timers.push(timer);
      });
      
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [showCardDealAnimation, sortedHand.length]);

  // 모든 카드가 dealt 상태가 되면 애니메이션 완료
  useEffect(() => {
    if (showCardDealAnimation && dealtCards.size === sortedHand.length && sortedHand.length > 0) {
      const timer = setTimeout(() => {
        handleCardDealComplete();
      }, 1000); // 마지막 카드 뒤집힌 후 1초 대기
      
      return () => clearTimeout(timer);
    }
  }, [dealtCards.size, sortedHand.length, showCardDealAnimation]);

  // 대기 중인 패들을 보드에 배치하는 함수
  const submitPendingCards = () => {
    if (pendingCards.length === 0) return;
    
    console.log('submitPendingCards 호출됨, 현재 보드 크기:', boardSize);
    
    // 대기 중인 패들을 보드에 추가 (기존 카드는 전혀 건드리지 않음)
    const newCards = pendingCards.map((card, index) => ({
      ...card,
      isNew: true,
      row: -1,
      col: -1
    }));
    
                    // 랜덤 위치 찾기 (기존 카드들과 겹치지 않고 좌우 여백 한 칸씩 필수)
        const findRandomPosition = (currentBoardSize = boardSize) => {
          // 가능한 모든 위치를 찾아서 랜덤하게 선택
          const availablePositions: Array<{ row: number; col: number }> = [];
          
          // 모든 행에서 시도
          for (let row = 0; row < currentBoardSize.rows; row++) {
            // 해당 행의 모든 기존 카드 위치 확인
            const rowCards = boardCards.filter(c => c.row === row).sort((a, b) => a.col - b.col);
            
            // 해당 행에 카드가 없으면 모든 위치가 가능
            if (rowCards.length === 0) {
              if (newCards.length <= currentBoardSize.cols) {
                for (let startCol = 0; startCol <= currentBoardSize.cols - newCards.length; startCol++) {
                  availablePositions.push({ row, col: startCol });
                }
              }
              continue;
            }
            
            // 기존 카드들 사이의 빈 공간 찾기
            for (let startCol = 0; startCol <= currentBoardSize.cols - newCards.length; startCol++) {
              let canPlace = true;
              
              // 1. 새로운 카드들이 들어갈 위치에 기존 카드가 있는지 확인
              for (let i = 0; i < newCards.length; i++) {
                const col = startCol + i;
                const existingCard = rowCards.find(c => c.col === col);
                if (existingCard) {
                  canPlace = false;
                  break;
                }
              }
              
              if (!canPlace) continue;
              
              // 2. 좌측 여백 확인 (새로운 카드들 왼쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
              const leftCard = rowCards.find(c => c.col === startCol - 1);
              if (leftCard) {
                canPlace = false;
                continue;
              }
              
              // 3. 우측 여백 확인 (새로운 카드들 오른쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
              const rightCard = rowCards.find(c => c.col === startCol + newCards.length);
              if (rightCard) {
                canPlace = false;
                continue;
              }
              
              if (canPlace) {
                availablePositions.push({ row, col: startCol });
              }
            }
          }
          
          // 가능한 위치가 있으면 랜덤하게 선택
          if (availablePositions.length > 0) {
            const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
            
            // 위치 할당
            newCards.forEach((card, index) => {
              card.row = randomPosition.row;
              card.col = randomPosition.col + index;
            });
            return true;
          }
          
          return false;
        };
    
    const success = findRandomPosition();
    
    if (success) {
      setBoardCards(prev => [...prev, ...newCards]);
      setPendingCards([]); // 대기 중인 패 제거
    } else {
      // 25x6에서도 실패한 경우, 여백 압축 시도
      const compressAndPlace = () => {
        console.log('submitPendingCards compressAndPlace 시작, newCards 길이:', newCards.length);
        
        // 압축은 실제로는 하지 않고, 단순히 새로운 카드를 배치할 수 있는지만 확인
        for (let targetRow = 0; targetRow < boardSize.rows; targetRow++) {
          const rowCards = boardCards.filter(c => c.row === targetRow).sort((a, b) => a.col - b.col);
          console.log(`submitPendingCards 행 ${targetRow}의 카드 수:`, rowCards.length);
          
          // 해당 행에 카드가 없으면 바로 배치 가능
          if (rowCards.length === 0) {
            console.log(`submitPendingCards 행 ${targetRow}가 비어있어서 바로 배치`);
            newCards.forEach((card, index) => {
              card.row = targetRow;
              card.col = index;
            });
            setBoardCards(prev => [...prev, ...newCards]);
            return true;
          }
          
          // 해당 행에 새로운 카드를 배치할 수 있는지 확인 (압축 없이)
          // 가능한 모든 위치를 찾아서 랜덤하게 선택
          const availablePositions: number[] = [];
          
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
              // 기존 카드들과의 여백 확인 (좌우 한 칸 이상 여백 필요)
              const leftCard = rowCards.find(c => c.col === col - 1);
              const rightCard = rowCards.find(c => c.col === col + newCards.length);
              
              // 좌우에 기존 카드가 있으면 여백이 있어야 함
              if (leftCard || rightCard) {
                console.log(`submitPendingCards 위치 ${col}에서 좌우 여백 문제로 배치 불가`);
                continue; // 이 위치는 사용할 수 없음
              }
              
              availablePositions.push(col);
            }
          }
          
          // 가능한 위치가 있으면 랜덤하게 선택
          if (availablePositions.length > 0) {
            const randomCol = availablePositions[Math.floor(Math.random() * availablePositions.length)];
            console.log(`submitPendingCards 위치 ${randomCol}에 새로운 카드 배치 성공 (랜덤 선택)`);
            
            // 새로운 카드들 배치
            newCards.forEach((card, index) => {
              card.row = targetRow;
              card.col = randomCol + index;
            });
            
            // 새로운 카드만 추가 (기존 카드는 전혀 건드리지 않음)
            setBoardCards(prev => [...prev, ...newCards]);
            return true;
          }
          
          console.log(`submitPendingCards 행 ${targetRow}에서 배치 실패`);
        }
        
        return false;
      };
      
      const compressedSuccess = compressAndPlace();
      if (compressedSuccess) {
        console.log('submitPendingCards: 압축 성공');
        setPendingCards([]); // 대기 중인 패 제거
      } else {
        console.log('submitPendingCards: 압축 실패');
        // 압축해도 실패하면 25x6으로 확장 시도
        if (boardSize.rows === 5 && boardSize.cols === 20) {
          console.log('submitPendingCards: 25x6으로 확장 시도');
          setBoardSize({ rows: 6, cols: 25 });
          // 확장 후 즉시 다시 시도 (useEffect에서 처리됨)
        } else {
          console.log('submitPendingCards: 확장 조건 불만족, 현재 보드 크기:', boardSize);
        }
      }
    }
  };

  // 보드 크기가 변경될 때 대기 중인 패 자동 제출
  useEffect(() => {
    if (pendingCards.length > 0) {
      console.log('useEffect: 보드 크기 변경 감지, submitPendingCards 호출');
      // 보드 크기 변경 시 즉시 제출 시도
      submitPendingCards();
    }
  }, [boardSize, pendingCards.length]);

  const handlePlayerCardReceived = (playerIndex: number) => {
    setPlayers(prev => prev.map((player, index) => 
      index === playerIndex 
        ? { ...player, remainingTiles: player.remainingTiles + 1 }
        : player
    ));
  };

  const handleCardSelect = (cardId: number) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  // 드래그 시작 핸들러
  const handleDragStart = (e: React.DragEvent, cardId: number) => {
    setDraggedCard(cardId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', cardId.toString());
    
    // 드래그 이미지 설정
    const cardElement = e.currentTarget as HTMLElement;
    const dragImage = cardElement.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '1';
    dragImage.style.transform = 'rotate(5deg) scale(1.1)';
    dragImage.style.zIndex = '1000';
    document.body.appendChild(dragImage);
    
    e.dataTransfer.setDragImage(dragImage, 25, 30);
    
    // 드래그 이미지 제거
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };

  // 드래그 오버 핸들러
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  // 드래그 리브 핸들러
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
  };

  // 드롭 핸들러
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedCard === null) return;
    
    const draggedIndex = sortedHand.findIndex(card => card.id === draggedCard);
    if (draggedIndex === -1) return;
    
    // 같은 위치에 드롭한 경우 무시
    if (draggedIndex === dropIndex) {
      setDraggedCard(null);
      setDragOverIndex(null);
      setIsDragging(false);
      return;
    }
    
    // 카드 순서 변경
    const newHand = [...sortedHand];
    const [draggedItem] = newHand.splice(draggedIndex, 1);
    newHand.splice(dropIndex, 0, draggedItem);
    
    setSortedHand(newHand);
    setDraggedCard(null);
    setDragOverIndex(null);
    setIsDragging(false);
  };

  // 드래그 엔드 핸들러
  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverIndex(null);
    setIsDragging(false);
  };

  const handlePass = () => {
    console.log('Pass 액션');
  };

  const handleSubmitCards = () => {
    if (selectedCards.length === 0) return;
    
    // 새로운 카드들을 보드에 추가 (기존 카드는 전혀 건드리지 않음)
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
    
    // 랜덤 위치 찾기 (기존 카드들과 겹치지 않고 좌우 여백 한 칸씩 필수)
    const findRandomPosition = (currentBoardSize = boardSize) => {
      // 가능한 모든 위치를 찾아서 랜덤하게 선택
      const availablePositions: Array<{ row: number; col: number }> = [];
      
      // 모든 행에서 시도
      for (let row = 0; row < currentBoardSize.rows; row++) {
        // 해당 행의 모든 기존 카드 위치 확인
        const rowCards = boardCards.filter(c => c.row === row).sort((a, b) => a.col - b.col);
        
        // 해당 행에 카드가 없으면 모든 위치가 가능
        if (rowCards.length === 0) {
          if (newCards.length <= currentBoardSize.cols) {
            for (let startCol = 0; startCol <= currentBoardSize.cols - newCards.length; startCol++) {
              availablePositions.push({ row, col: startCol });
            }
          }
          continue;
        }
        
        // 기존 카드들 사이의 빈 공간 찾기
        for (let startCol = 0; startCol <= currentBoardSize.cols - newCards.length; startCol++) {
          let canPlace = true;
          
          // 1. 새로운 카드들이 들어갈 위치에 기존 카드가 있는지 확인
          for (let i = 0; i < newCards.length; i++) {
            const col = startCol + i;
            const existingCard = rowCards.find(c => c.col === col);
            if (existingCard) {
              canPlace = false;
              break;
            }
          }
          
          if (!canPlace) continue;
          
          // 2. 좌측 여백 확인 (새로운 카드들 왼쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
          const leftCard = rowCards.find(c => c.col === startCol - 1);
          if (leftCard) {
            canPlace = false;
            continue;
          }
          
          // 3. 우측 여백 확인 (새로운 카드들 오른쪽에 기존 카드가 있으면 반드시 한 칸 이상 여백 필요)
          const rightCard = rowCards.find(c => c.col === startCol + newCards.length);
          if (rightCard) {
            canPlace = false;
            continue;
          }
          
          if (canPlace) {
            availablePositions.push({ row, col: startCol });
          }
        }
      }
      
      // 가능한 위치가 있으면 랜덤하게 선택
      if (availablePositions.length > 0) {
        const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        
        // 위치 할당
        newCards.forEach((card, index) => {
          card.row = randomPosition.row;
          card.col = randomPosition.col + index;
        });
        return true;
      }
      
      return false;
    };
    
    // 여백 압축 및 배치 함수
    const compressAndPlace = () => {
      console.log('compressAndPlace 시작, newCards 길이:', newCards.length);
      
      // 압축은 실제로는 하지 않고, 단순히 새로운 카드를 배치할 수 있는지만 확인
      for (let targetRow = 0; targetRow < boardSize.rows; targetRow++) {
        const rowCards = boardCards.filter(c => c.row === targetRow).sort((a, b) => a.col - b.col);
        console.log(`행 ${targetRow}의 카드 수:`, rowCards.length);
        
        // 해당 행에 카드가 없으면 바로 배치 가능
        if (rowCards.length === 0) {
          console.log(`행 ${targetRow}가 비어있어서 바로 배치`);
          newCards.forEach((card, index) => {
            card.row = targetRow;
            card.col = index;
          });
          // 새로운 카드만 추가 (기존 카드는 전혀 건드리지 않음)
          setBoardCards(prev => [...prev, ...newCards]);
          return true;
        }
        
                  // 해당 행에 새로운 카드를 배치할 수 있는지 확인 (압축 없이)
          // 가능한 모든 위치를 찾아서 랜덤하게 선택
          const availablePositions: number[] = [];
          
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
              // 기존 카드들과의 여백 확인 (좌우 한 칸 이상 여백 필요)
              const leftCard = rowCards.find(c => c.col === col - 1);
              const rightCard = rowCards.find(c => c.col === col + newCards.length);
              
              // 좌우에 기존 카드가 있으면 여백이 있어야 함
              if (leftCard || rightCard) {
                console.log(`위치 ${col}에서 좌우 여백 문제로 배치 불가`);
                continue; // 이 위치는 사용할 수 없음
              }
              
              availablePositions.push(col);
            }
          }
          
          // 가능한 위치가 있으면 랜덤하게 선택
          if (availablePositions.length > 0) {
            const randomCol = availablePositions[Math.floor(Math.random() * availablePositions.length)];
            console.log(`위치 ${randomCol}에 새로운 카드 배치 성공 (랜덤 선택)`);
            
            // 새로운 카드들 배치
            newCards.forEach((card, index) => {
              card.row = targetRow;
              card.col = randomCol + index;
            });
            
            // 새로운 카드만 추가 (기존 카드는 전혀 건드리지 않음)
            setBoardCards(prev => [...prev, ...newCards]);
            return true;
          }
        
        console.log(`행 ${targetRow}에서 배치 실패`);
      }
      
      return false;
    };
    
    const success = findRandomPosition();
    
    // 위치를 찾지 못한 경우 보드 확장
    if (!success && boardSize.rows === 4 && boardSize.cols === 15) {
      console.log('15x4에서 20x5로 확장 시도');
      // 보드 확장만 하고 기존 카드는 전혀 건드리지 않음
      setBoardSize({ rows: 5, cols: 20 });
      // 확장 후 다시 위치 찾기 시도
      setTimeout(() => {
        const retrySuccess = findRandomPosition({ rows: 5, cols: 20 });
        if (retrySuccess) {
          console.log('20x5 확장 성공');
          // 새로운 카드만 추가 (기존 카드들은 전혀 건드리지 않음)
          setBoardCards(prev => [...prev, ...newCards]);
          // 확장 성공 후 대기 중인 카드들도 자동으로 등록 시도
          setTimeout(() => {
            if (pendingCards.length > 0) {
              submitPendingCards();
            }
          }, 200);
        } else {
          console.log('20x5 확장 실패, 대기 중인 패에 저장');
          // 여전히 실패하면 대기 중인 패에 저장
          setPendingCards(prev => [...prev, ...newCards]);
        }
      }, 100);
    } else if (!success && (boardSize.rows === 5 && boardSize.cols === 20)) {
      console.log('20x5에서 압축 시도');
      // 20x5에서도 실패한 경우, 여백 압축 시도
      const compressedSuccess = compressAndPlace();
      if (compressedSuccess) {
        console.log('압축 성공');
        // 압축 성공 시 이미 setBoardCards가 호출되었으므로 추가 작업 불필요
        // 압축 성공 후 대기 중인 카드들도 자동으로 등록 시도
        setTimeout(() => {
          if (pendingCards.length > 0) {
            submitPendingCards();
          }
        }, 200);
      } else {
        console.log('압축 실패, 25x6으로 확장 시도');
        // 압축해도 실패하면 25x6으로 확장 (기존 카드는 전혀 건드리지 않음)
        setBoardSize({ rows: 6, cols: 25 });
        setTimeout(() => {
          const retrySuccess = findRandomPosition({ rows: 6, cols: 25 });
          if (retrySuccess) {
            console.log('25x6 확장 성공');
            // 새로운 카드만 추가 (기존 카드들은 전혀 건드리지 않음)
            setBoardCards(prev => [...prev, ...newCards]);
            // 확장 성공 후 대기 중인 카드들도 자동으로 등록 시도
            setTimeout(() => {
              if (pendingCards.length > 0) {
                submitPendingCards();
              }
            }, 200);
          } else {
            console.log('25x6 확장 실패, 대기 중인 패에 저장');
            // 여전히 실패하면 대기 중인 패에 저장
            setPendingCards(prev => [...prev, ...newCards]);
          }
        }, 100);
      }
    } else if (success) {
      // 성공한 경우에만 기존 카드들의 isNew를 false로 설정하고 새로운 카드 추가
      setBoardCards(prev => [...prev.map(card => ({ ...card, isNew: false })), ...newCards]);
    }
    
    // 하단 패 영역에서 선택된 카드들을 삭제하고 남은 패 개수 업데이트
    if (success || (boardSize.rows === 4 && boardSize.cols === 15) || (boardSize.rows === 5 && boardSize.cols === 20)) {
      // 선택된 카드들을 하단 패에서 제거
      setSortedHand(prev => prev.filter(card => !selectedCards.includes(card.id)));
      setVisibleHand(prev => prev.filter(card => !selectedCards.includes(card.id)));
      
      // 현재 플레이어의 남은 패 개수 업데이트
      setPlayers(prev => prev.map(player => 
        player.isCurrentPlayer 
          ? { ...player, remainingTiles: player.remainingTiles - selectedCards.length }
          : player
      ));
    }
    
    setSelectedCards([]);
  };

  const handleSortByNumber = () => {
    setIsSorting(true);
    
    // 정렬된 순서 계산
    const sorted = [...sortedHand].sort((a, b) => a.value - b.value);
    
    // 각 카드의 이동 거리 계산
    const offsets: { [key: number]: number } = {};
    sortedHand.forEach((card, currentIndex) => {
      const newIndex = sorted.findIndex(c => c.id === card.id);
      if (newIndex !== currentIndex) {
        // 카드 간격을 동적으로 계산 (카드 너비 + gap)
        const cardWidth = handRef.current ? handRef.current.children[0]?.clientWidth || 0 : 0;
        const gap = 6; // CSS에서 설정된 gap
        const cardSpacing = cardWidth + gap;
        offsets[card.id] = (newIndex - currentIndex) * cardSpacing + 6;
      }
    });
    
    setCardOffsets(offsets);
    
    // 애니메이션 완료 후 배열 업데이트
    setTimeout(() => {
      setSortedHand(sorted);
      setCardOffsets({});
      setIsSorting(false);
    }, 800); // CSS 애니메이션 시간과 맞춤
  };

  const handleSortByColor = () => {
    setIsSorting(true);
    
    // 정렬된 순서 계산
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
    
    // 각 카드의 이동 거리 계산
    const offsets: { [key: number]: number } = {};
    sortedHand.forEach((card, currentIndex) => {
      const newIndex = sorted.findIndex(c => c.id === card.id);
      if (newIndex !== currentIndex) {
        // 카드 간격을 동적으로 계산 (카드 너비 + gap)
        const cardWidth = handRef.current ? handRef.current.children[0]?.clientWidth || 0 : 0;
        const gap = 6; // CSS에서 설정된 gap
        const cardSpacing = cardWidth + gap;
        offsets[card.id] = (newIndex - currentIndex) * cardSpacing;
      }
    });
    
    setCardOffsets(offsets);
    
    // 애니메이션 완료 후 배열 업데이트
    setTimeout(() => {
      setSortedHand(sorted);
      setCardOffsets({});
      setIsSorting(false);
    }, 800); // CSS 애니메이션 시간과 맞춤
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
      {/* 카드 분배 애니메이션 */}
      <CardDealAnimation
        isVisible={showCardDealAnimation}
        onComplete={handleCardDealComplete}
        playerCount={players.length}
        cardsPerPlayer={16}
        myPlayerIndex={players.findIndex(p => p.isCurrentPlayer)} // 현재 플레이어 인덱스
        myHand={myHand}
        onPlayerCardReceived={handlePlayerCardReceived}
        onMyCardDealt={handleMyCardDealt}
        gameMode={gameMode}
      />
      
      <div className="game-container">
        {/* 상단 좌측 - 다른 플레이어 정보 */}
        <div className="top-left-section">
          <div className="other-players">
            {players.filter(player => !player.isCurrentPlayer).map((player, index) => (
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
                  <AnimatedRemainingTiles count={player.remainingTiles} />
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
                    <AnimatedRemainingTiles count={showCardDealAnimation ? dealtCards.size : sortedHand.length} />
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
                <button 
                  className={`control-btn ${showCardDealAnimation ? 'disabled' : ''}`} 
                  onClick={showCardDealAnimation ? undefined : handleViewCombinations}
                  disabled={showCardDealAnimation}
                >
                  족보보기
                </button>
                <button 
                  className={`control-btn ${showCardDealAnimation ? 'disabled' : ''}`} 
                  onClick={showCardDealAnimation ? undefined : handleModeChange}
                  disabled={showCardDealAnimation}
                >
                  {gameMode === 'beginner' ? '초보모드' : '일반모드'}
                </button>
              </div>
            </div>

            {/* 우측 - Drop/Pass 버튼 */}
            <div className="action-buttons">
              <button 
                className={`action-btn drop-btn ${showCardDealAnimation ? 'disabled' : ''}`} 
                onClick={showCardDealAnimation ? undefined : handleSubmitCards}
                disabled={showCardDealAnimation}
              >
                Submit
              </button>
              <button 
                className={`action-btn pass-btn ${showCardDealAnimation ? 'disabled' : ''}`} 
                onClick={showCardDealAnimation ? undefined : handlePass}
                disabled={showCardDealAnimation}
              >
                Pass
              </button>
            </div>
          </div>

          {/* 하단 하단 - 내 손패 및 정렬 버튼 */}
          <div className="bottom-bottom">
            {/* 내 손패 */}
            <div className={`my-hand ${showCardDealAnimation ? 'dealing' : ''}`} ref={handRef}>
              {(showCardDealAnimation ? visibleHand : sortedHand).map((tile, index) => (
                <div 
                  key={tile.id} 
                  className={`hand-tile ${getDisplayColor(tile.color, gameMode)} ${selectedCards.includes(tile.id) ? 'selected' : ''} ${draggedCard === tile.id ? 'dragging' : ''} ${isSorting ? 'sorting' : ''} ${showCardDealAnimation ? 'dealing' : ''} ${dealtCards.has(index) ? 'dealt' : ''}`}
                  style={isSorting && cardOffsets[tile.id] !== undefined ? {
                    transform: `translateX(${cardOffsets[tile.id]}px)`
                  } : showCardDealAnimation ? {
                    animationDelay: `${index * 0.12}s`
                  } : {}}
                  onClick={showCardDealAnimation ? undefined : () => handleCardSelect(tile.id)}
                  draggable={!isSorting && !showCardDealAnimation}
                  onDragStart={showCardDealAnimation ? undefined : (e: React.DragEvent) => handleDragStart(e, tile.id)}
                  onDragOver={showCardDealAnimation ? undefined : (e: React.DragEvent) => handleDragOver(e, index)}
                  onDragLeave={showCardDealAnimation ? undefined : handleDragLeave}
                  onDrop={showCardDealAnimation ? undefined : (e: React.DragEvent) => handleDrop(e, index)}
                  onDragEnd={showCardDealAnimation ? undefined : handleDragEnd}
                >
                  {/* 카드 분배 애니메이션 중에는 뒷면만 표시 */}
                  {showCardDealAnimation && !dealtCards.has(index) ? (
                    <div className="card-back-animation" />
                  ) : (
                    <>
                      {getCardImage(getDisplayColor(tile.color, gameMode)) && (
                        <img 
                          src={getCardImage(getDisplayColor(tile.color, gameMode))!} 
                          alt={getDisplayColor(tile.color, gameMode)} 
                          className="card-image"
                        />
                      )}
                      <span className="tile-value">{tile.value}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            {/* 정렬 버튼들 */}
            <div className="sort-buttons">
              <button 
                className={`sort-btn ${showCardDealAnimation ? 'disabled' : ''}`} 
                onClick={showCardDealAnimation ? undefined : handleSortByNumber}
                disabled={showCardDealAnimation}
              >
                숫자정렬
              </button>
              <button 
                className={`sort-btn ${showCardDealAnimation ? 'disabled' : ''}`} 
                onClick={showCardDealAnimation ? undefined : handleSortByColor}
                disabled={showCardDealAnimation}
              >
                색상정렬
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
        gameMode={gameMode}
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