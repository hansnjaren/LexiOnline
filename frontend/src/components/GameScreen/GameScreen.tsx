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
import ColyseusService from '../../services/ColyseusService';

interface GameScreenProps {
  onScreenChange: (screen: 'lobby' | 'waiting' | 'game' | 'result') => void;
  playerCount: number;
}

interface Player {
  id: string;
  nickname: string;
  score: number;
  remainingTiles: number;
  isCurrentPlayer: boolean;
  sessionId: string;
}

interface GameState {
  players: Map<string, Player>;
  playerOrder: string[];
  currentPlayerIndex: number;
  lastCards: number[];
  lastType: number;
  lastMadeType: number;
  lastHighestValue: number;
  round: number;
  totalRounds: number;
  easyMode: boolean;
  maxNumber: number;
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
  const [gameMode, setGameMode] = useState<'easyMode' | 'normal'>('easyMode');
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
  const [showCardDealAnimation, setShowCardDealAnimation] = useState(false);
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
  
  // 플레이어 정보 (백엔드에서 동적으로 가져옴)
  const [players, setPlayers] = useState<Player[]>([]);
  const [mySessionId, setMySessionId] = useState<string>('');
  const [myHand, setMyHand] = useState<Array<{
    id: number;
    value: number;
    color: string;
    originalNumber: number;
  }>>([]);

  // Colyseus 연결 초기화
  useEffect(() => {
    const room = ColyseusService.getRoom();
    if (!room) {
      console.error('방에 연결되지 않았습니다.');
      onScreenChange('lobby');
      return;
    }

    // 내 세션 ID 저장
    setMySessionId(room.sessionId);

    // 게임 화면 진입 시 즉시 플레이어 정보 요청
    room.send("requestPlayerInfo");

    // 게임 상태 구독
    room.onStateChange((state) => {
      console.log('게임 상태 변경:', state);
      
      // 플레이어 정보 업데이트
      if (state.players && state.playerOrder) {
        const playerList: Player[] = [];
        
        // playerOrder 순서대로 플레이어 정보 구성
        state.playerOrder.forEach((sessionId: string, index: number) => {
          const player = state.players.get(sessionId);
          if (player) {
            playerList.push({
              id: index.toString(),
              nickname: player.nickname || '익명',
              score: player.score || 0,
              remainingTiles: player.hand ? player.hand.length : 0,
              isCurrentPlayer: sessionId === room.sessionId,
              sessionId: sessionId
            });
          }
        });
        
        setPlayers(playerList);
        
        // 백엔드 상태로부터 모든 플레이어의 남은 카드 수 동기화
        syncPlayerRemainingCards();
        
        // 게임이 이미 시작되었고 손패가 있다면 손패만 업데이트 (애니메이션 없이)
        const myPlayer = state.players.get(room.sessionId);
        if (myPlayer && myPlayer.hand && myPlayer.hand.length > 0 && !showCardDealAnimation) {
          console.log('이미 라운드가 시작됨, 손패만 업데이트 (애니메이션 없이)');
          const handCards = myPlayer.hand.map((cardNumber: number, index: number) => {
            const color = getCardColorFromNumber(cardNumber);
            const value = getCardValueFromNumber(cardNumber);
            return {
              id: index,
              value: value,
              color: color,
              originalNumber: cardNumber
            };
          });
          
          setMyHand(handCards);
          setSortedHand(handCards);
          setVisibleHand(handCards);
        }
      }
    });

    // 게임 메시지 수신
    room.onMessage('playerInfoResponse', (message) => {
      console.log('플레이어 정보 응답:', message);
      console.log(`[DEBUG] 게임 시작 여부: ${message.isGameStarted}, 손패 길이: ${message.myHand?.length || 0}`);
      
      // 플레이어 정보 설정
      const playerList: Player[] = message.players.map((p: any) => ({
        id: p.sessionId,
        nickname: p.nickname,
        score: p.score,
        remainingTiles: p.remainingTiles,
        isCurrentPlayer: p.isCurrentPlayer,
        sessionId: p.sessionId
      }));
      
      setPlayers(playerList);
      
      // 게임이 이미 시작되었고 손패가 있다면 손패만 업데이트 (애니메이션 없이)
      if (message.isGameStarted && message.myHand && message.myHand.length > 0) {
        console.log('게임이 이미 시작됨, 손패 정보로 손패만 업데이트 (애니메이션 없이)');
        const handCards = message.myHand.map((cardNumber: number, index: number) => {
          const color = getCardColorFromNumber(cardNumber);
          const value = getCardValueFromNumber(cardNumber);
          return {
            id: index,
            value: value,
            color: color,
            originalNumber: cardNumber
          };
        });
        
        setMyHand(handCards);
        setSortedHand(handCards);
        setVisibleHand(handCards);
      } else {
        console.log('[DEBUG] 게임이 시작되지 않았거나 손패가 없음');
      }
    });

    room.onMessage('gameEnded', (message) => {
      console.log('게임 종료:', message);
      onScreenChange('result');
    });

    room.onMessage('roundStart', (message) => {
      console.log('라운드 시작:', message);
      
      // 내 손패 설정
      if (message.hand) {
        const handCards = message.hand.map((cardNumber: number, index: number) => {
          // 카드 번호를 색상과 값으로 변환
          const color = getCardColorFromNumber(cardNumber);
          const value = getCardValueFromNumber(cardNumber);
          
          return {
            id: index,
            value: value,
            color: color,
            originalNumber: cardNumber // 원본 카드 번호 저장
          };
        });
        
        setMyHand(handCards);
        setSortedHand(handCards);
        
        // 카드 분배 애니메이션 시작
        setShowCardDealAnimation(true);
        setDealtCards(new Set());
        setVisibleHand([]);
      }

      // 모든 플레이어 정보 업데이트
      if (message.allPlayers) {
        const updatedPlayers: Player[] = message.allPlayers.map((p: any) => ({
          id: p.sessionId,
          nickname: p.nickname,
          score: p.score,
          remainingTiles: p.remainingTiles,
          isCurrentPlayer: p.isCurrentPlayer,
          sessionId: p.sessionId
        }));
        
        setPlayers(updatedPlayers);
        console.log('라운드 시작 시 플레이어 목록 업데이트:', updatedPlayers);
        
        // 현재 턴 플레이어 정보 출력
        const currentPlayer = updatedPlayers.find(p => p.isCurrentPlayer);
        const isMyTurn = currentPlayer && currentPlayer.sessionId === room.sessionId;
        console.log(`[DEBUG] 라운드 시작 - 현재 턴: ${currentPlayer?.nickname || '알 수 없음'}, 내 턴인가?: ${isMyTurn}`);
      }
    });

    room.onMessage('submitted', (message) => {
      console.log('카드 제출:', message);
      
      // 내가 카드를 제출했을 때 손패에서 제거
      if (message.playerId === room.sessionId) {
        // 백엔드에서 제출된 카드들을 손패에서 제거
        const room = ColyseusService.getRoom();
        if (room) {
          const myPlayer = room.state.players.get(room.sessionId);
          if (myPlayer && myPlayer.hand) {
            // 백엔드의 손패를 기반으로 프론트엔드 손패 업데이트 (애니메이션 없이)
            const handCards = myPlayer.hand.map((cardNumber: number, index: number) => {
              const color = getCardColorFromNumber(cardNumber);
              const value = getCardValueFromNumber(cardNumber);
              return {
                id: index,
                value: value,
                color: color,
                originalNumber: cardNumber // 원본 카드 번호 저장
              };
            });
            
            // 카드 분배 애니메이션 없이 직접 업데이트
            setMyHand(handCards);
            setSortedHand(handCards);
            setVisibleHand(handCards); // visibleHand도 직접 업데이트
          }
        }
        
        // 제출된 카드들을 pendingCards에 추가하여 게임 보드에 배치
        const submittedCards = message.cards.map((cardNumber: number, index: number) => {
          const color = getCardColorFromNumber(cardNumber);
          const value = getCardValueFromNumber(cardNumber);
          return {
            id: Date.now() + index, // 고유 ID 생성
            value: value,
            color: color
          };
        });
        
        setPendingCards(prev => [...prev, ...submittedCards]);
      }
      
      // 백엔드 상태로부터 모든 플레이어의 남은 카드 수 동기화
      syncPlayerRemainingCards();
    });

    room.onMessage('pass', (message) => {
      console.log('패스:', message);
      
      // 백엔드 상태로부터 모든 플레이어의 남은 카드 수 동기화
      syncPlayerRemainingCards();
    });

    room.onMessage('turnChanged', (message) => {
      console.log('턴 변경:', message);
      
      // 모든 플레이어 정보 업데이트
      if (message.allPlayers) {
        const updatedPlayers: Player[] = message.allPlayers.map((p: any) => ({
          id: p.sessionId,
          nickname: p.nickname,
          score: p.score,
          remainingTiles: p.remainingTiles,
          isCurrentPlayer: p.isCurrentPlayer,
          sessionId: p.sessionId
        }));
        
        setPlayers(updatedPlayers);
        console.log('턴 변경 시 플레이어 목록 업데이트:', updatedPlayers);
        
        // 현재 턴 플레이어 정보 출력
        const currentPlayer = updatedPlayers.find(p => p.isCurrentPlayer);
        const isMyTurn = currentPlayer && currentPlayer.sessionId === room.sessionId;
        console.log(`[DEBUG] 현재 턴: ${currentPlayer?.nickname || '알 수 없음'}, 내 턴인가?: ${isMyTurn}`);
      }
    });

    room.onMessage('submitRejected', (message) => {
      console.log('카드 제출 거부:', message);
      alert('카드 제출이 거부되었습니다: ' + message.reason);
    });

    room.onMessage('noCard', (message) => {
      console.log('카드 없음 오류:', message);
      alert('보유하지 않은 카드를 제출하려고 했습니다: ' + message.reason);
    });

    room.onMessage('passRejected', (message) => {
      console.log('패스 거부:', message);
      alert('패스가 거부되었습니다: ' + message.reason);
    });

    room.onMessage('invalidPlayer', (message) => {
      console.log('플레이어 정보 오류:', message);
      alert('플레이어 정보가 유효하지 않습니다: ' + message.reason);
    });

    room.onMessage('gameStarted', (message) => {
      console.log('게임 시작:', message);
      setIsGameStarted(true);
      // 백엔드에서 받은 easyMode 상태로 프론트엔드 상태 동기화
      if (message.easyMode !== undefined) {
        setGameMode(message.easyMode ? 'easyMode' : 'normal');
      }
    });

    room.onMessage('gameReset', (message) => {
      console.log('게임 상태 초기화:', message);
      setIsGameStarted(false);
      setMyHand([]);
      setSortedHand([]);
      setShowCardDealAnimation(false);
      setDealtCards(new Set());
      setVisibleHand([]);
      setSelectedCards([]);
      setPendingCards([]);
    });

    // 방에서 나갈 때 정리
    return () => {
      room.onLeave(() => {
        console.log('게임에서 나갔습니다.');
      });
    };
  }, [onScreenChange]);

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
  const getDisplayColor = (originalColor: string, mode: 'easyMode' | 'normal') => {
    if (mode === 'easyMode') {
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

  // 현재 플레이어가 자신인지 확인하는 함수
  const isMyTurn = () => {
    const room = ColyseusService.getRoom();
    if (!room) return false;
    
    // 백엔드 상태에서 직접 현재 플레이어 확인
    if (room.state && room.state.playerOrder && room.state.nowPlayerIndex !== undefined) {
      const currentPlayerSessionId = room.state.playerOrder[room.state.nowPlayerIndex];
      const isMyTurn = currentPlayerSessionId === room.sessionId;
      
      // 디버깅을 위한 로그
      console.log(`[DEBUG] isMyTurn 체크 - 백엔드 상태:`, {
        playerOrder: room.state.playerOrder,
        nowPlayerIndex: room.state.nowPlayerIndex,
        currentPlayerSessionId,
        mySessionId: room.sessionId,
        isMyTurn
      });
      
      return isMyTurn;
    }
    
    // 백엔드 상태가 없으면 프론트엔드 상태로 확인
    const currentPlayer = players.find(p => p.isCurrentPlayer);
    const isMyTurn = currentPlayer && currentPlayer.sessionId === room.sessionId;
    
    console.log(`[DEBUG] isMyTurn 체크 - 프론트엔드 상태:`, {
      currentPlayer: currentPlayer?.nickname || '알 수 없음',
      mySessionId: room.sessionId,
      isMyTurn
    });
    
    return isMyTurn;
  };

  // 카드 번호를 색상으로 변환
  const getCardColorFromNumber = (cardNumber: number): string => {
    // 카드 번호를 4로 나눈 나머지로 색상 결정
    const colorIndex = cardNumber % 4;
    const colors = ['gold', 'silver', 'bronze', 'black'];
    return colors[colorIndex];
  };

  // 카드 번호를 값으로 변환
  const getCardValueFromNumber = (cardNumber: number): number => {
    // 카드 번호를 4로 나눈 몫 + 1로 값 결정
    return Math.floor(cardNumber / 4) + 1;
  };

  // 백엔드 상태로부터 모든 플레이어의 남은 카드 수 동기화
  const syncPlayerRemainingCards = () => {
    const room = ColyseusService.getRoom();
    if (!room) return;
    
    setPlayers(prevPlayers => 
      prevPlayers.map(player => {
        const backendPlayer = room.state.players.get(player.sessionId);
        return {
          ...player,
          remainingTiles: backendPlayer && backendPlayer.hand ? backendPlayer.hand.length : 0
        };
      })
    );
  };

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
    setDealtCards(new Set());
    setVisibleHand([...myHand]); // 모든 카드를 visibleHand에 설정
    
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
      console.log('useEffect: pendingCards 변경 감지, submitPendingCards 호출');
      // pendingCards가 추가되거나 보드 크기가 변경될 때 즉시 제출 시도
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
    // 턴 체크 - 자신의 차례가 아니면 함수 실행 중단
    if (!isMyTurn()) {
      console.log('[DEBUG] handlePass - 자신의 차례가 아님, 함수 실행 중단');
      return;
    }
    
    const room = ColyseusService.getRoom();
    if (room) {
      room.send('pass');
    }
  };

  const handleSubmitCards = () => {
    // 턴 체크 - 자신의 차례가 아니면 함수 실행 중단
    if (!isMyTurn()) {
      console.log('[DEBUG] handleSubmitCards - 자신의 차례가 아님, 함수 실행 중단');
      return;
    }
    
    if (selectedCards.length === 0) {
      alert('제출할 카드를 선택해주세요.');
      return;
    }

    // 선택된 카드들을 백엔드로 전송
    const room = ColyseusService.getRoom();
    if (room) {
      // 카드 번호로 변환 (백엔드 형식)
      const cardNumbers = selectedCards.map(cardId => {
        // sortedHand에서 선택된 카드의 정보를 가져오기
        const selectedCard = sortedHand.find(c => c.id === cardId);
        if (!selectedCard) {
          console.error('선택된 카드를 찾을 수 없습니다:', cardId);
          return null;
        }
        
        // 백엔드에서 직접 손패 정보를 가져와서 카드 번호 찾기
        const room = ColyseusService.getRoom();
        if (room) {
          const myPlayer = room.state.players.get(room.sessionId);
          if (myPlayer && myPlayer.hand) {
            // 백엔드 손패에서 해당 카드의 번호 찾기
            for (const cardNumber of myPlayer.hand) {
              const color = getCardColorFromNumber(cardNumber);
              const value = getCardValueFromNumber(cardNumber);
              if (color === selectedCard.color && value === selectedCard.value) {
                return cardNumber;
              }
            }
          }
        }
        
        console.error('백엔드에서 카드 번호를 찾을 수 없습니다:', selectedCard);
        return null;
      }).filter(num => num !== null);

      console.log('[DEBUG] 제출하려는 카드들:', {
        selectedCards,
        cardNumbers,
        myHand: myHand.map(c => ({ id: c.id, value: c.value, color: c.color, originalNumber: c.originalNumber })),
        sortedHand: sortedHand.map(c => ({ id: c.id, value: c.value, color: c.color }))
      });

      // 백엔드에 submit 메시지 전송
      console.log(`[DEBUG] submit 메시지 전송: sessionId=${room.sessionId}, submitCards=${cardNumbers.join(', ')}`);
      room.send('submit', { submitCards: cardNumbers });
      
      // 선택 상태 초기화 (백엔드 응답 대기)
      setSelectedCards([]);
    }
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
    const colorOrder = gameMode === 'easyMode'
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
    const newMode = gameMode === 'easyMode' ? 'normal' : 'easyMode';
    setGameMode(newMode);
    
    // 백엔드에 easyMode 상태 전송
    const room = ColyseusService.getRoom();
    if (room) {
      room.send('easyMode', { easyMode: newMode === 'easyMode' });
    }
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
        gameMode={gameMode as 'easyMode' | 'normal'}
      />
      
      <div className="game-container">
        {/* 상단 좌측 - 다른 플레이어 정보 */}
        <div className="top-left-section">
          <div className="other-players">
            {players.filter(player => !player.isCurrentPlayer).map((player, index) => (
              <div key={player.id} className="player-info-container">
                <div className={`player-info-box ${player.isCurrentPlayer ? 'current-turn' : ''}`}>
                  <div className="player-info">
                    <div className="player-nickname">{player.nickname}</div>
                    <div className="player-coins">
                      <img src={coinImage} alt="코인" className="coin-icon" />
                      {player.score}
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
              <div className={`my-info-box ${players.find(p => p.isCurrentPlayer)?.sessionId === mySessionId ? 'current-turn' : ''}`}>
                <div className="my-nickname">
                  {players.find(p => p.isCurrentPlayer)?.nickname || '닉네임'}
                </div>
                <div className="my-stats">
                  <span className="my-coins">
                    <img src={coinImage} alt="코인" className="coin-icon" />
                    {players.find(p => p.isCurrentPlayer)?.score || 0}
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
                  {gameMode === 'easyMode' ? '초보모드' : '일반모드'}
                </button>

              </div>
            </div>

            {/* 우측 - Drop/Pass 버튼 */}
            <div className="action-buttons">
              <button 
                className={`action-btn drop-btn ${showCardDealAnimation || !isMyTurn() ? 'disabled' : ''}`} 
                onClick={(e) => {
                  e.preventDefault();
                  if (showCardDealAnimation || !isMyTurn()) {
                    console.log('[DEBUG] Submit 버튼 클릭 - 비활성화 상태');
                    return;
                  }
                  handleSubmitCards();
                }}
                disabled={showCardDealAnimation || !isMyTurn()}
                title={!isMyTurn() ? '다른 플레이어의 차례입니다' : '카드를 제출합니다'}
              >
                Submit
              </button>
              <button 
                className={`action-btn pass-btn ${showCardDealAnimation || !isMyTurn() ? 'disabled' : ''}`} 
                onClick={(e) => {
                  e.preventDefault();
                  if (showCardDealAnimation || !isMyTurn()) {
                    console.log('[DEBUG] Pass 버튼 클릭 - 비활성화 상태');
                    return;
                  }
                  handlePass();
                }}
                disabled={showCardDealAnimation || !isMyTurn()}
                title={!isMyTurn() ? '다른 플레이어의 차례입니다' : '패스합니다'}
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
                  style={{
                    ...(isSorting && cardOffsets[tile.id] !== undefined ? {
                      transform: `translateX(${cardOffsets[tile.id]}px)`
                    } : showCardDealAnimation ? {
                      animationDelay: `${index * 0.12}s`
                    } : {}),
                    cursor: showCardDealAnimation ? 'not-allowed' : 'pointer'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (showCardDealAnimation) {
                      console.log('[DEBUG] 카드 클릭 - 카드 분배 애니메이션 중');
                      return;
                    }
                    handleCardSelect(tile.id);
                  }}
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