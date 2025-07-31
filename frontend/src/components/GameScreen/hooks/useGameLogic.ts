import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import ColyseusService from '../../../services/ColyseusService';
import { Player, Card, BoardCard, GameState } from '../types';
import { useCardUtils } from './useCardUtils';
import { useColyseusEffects } from './useColyseusEffects';

type ScreenType = 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult';

export const useGameLogic = (onScreenChange: (screen: ScreenType, data?: any) => void) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [mySessionId, setMySessionId] = useState<string>('');
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [sortedHand, setSortedHand] = useState<Card[]>([]);
  const [visibleHand, setVisibleHand] = useState<Card[]>([]);
  
  const [gameState, setGameState] = useState<GameState>({
    lastType: 0,
    lastMadeType: 0,
    lastHighestValue: -1,
    currentTurnId: 0,
    maxNumber: 13,
    round: 1,
    totalRounds: 5
  });
  
  const [gameMode, setGameMode] = useState<'easyMode' | 'normal'>('easyMode');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [boardCards, setBoardCards] = useState<BoardCard[]>([]);
  const [boardSize, setBoardSize] = useState({ rows: 4, cols: 15 });

  // Animation & UI states
  const [showCardDealAnimation, setShowCardDealAnimation] = useState(false);
  const [dealtCards, setDealtCards] = useState<Set<number>>(new Set());
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [waitingForNextRound, setWaitingForNextRound] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState<Set<string>>(new Set());
  const [showBoardMask, setShowBoardMask] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drag & Drop states
  const [draggedCard, setDraggedCard] = useState<number | null>(null);
  const [isSorting, setIsSorting] = useState(false);
  const [cardOffsets, setCardOffsets] = useState<{ [key: number]: number }>({});
  const handRef = useRef<HTMLDivElement>(null);

  const { canSubmitCards, getCardColorFromNumber, getCardValueFromNumber } = useCardUtils(gameState, gameMode);

  const applySavedSortOrder = useCallback((handCards: Card[]) => {
    const room = ColyseusService.getRoom();
    if (!room || !mySessionId) return handCards;

    const sortOrderKey = `sortOrder-${room.roomId}-${mySessionId}`;
    const savedOrderJSON = sessionStorage.getItem(sortOrderKey);

    if (savedOrderJSON) {
      try {
        const savedOrder: number[] = JSON.parse(savedOrderJSON);
        const handCardMap = new Map(handCards.map(card => [card.originalNumber, card]));
        
        const sorted = savedOrder
          .map(originalNumber => handCardMap.get(originalNumber))
          .filter((card): card is Card => card !== undefined);

        const remainingCards = handCards.filter(card => !savedOrder.includes(card.originalNumber));
        
        return [...sorted, ...remainingCards];
      } catch (e) {
        console.error("Failed to parse sort order from sessionStorage", e);
        sessionStorage.removeItem(sortOrderKey);
        return handCards;
      }
    }
    return handCards;
  }, [mySessionId]);

  useColyseusEffects({
    onScreenChange,
    mySessionId, setMySessionId,
    setPlayers,
    setGameState,
    setMyHand,
    setSortedHand,
    setVisibleHand,
    setBoardCards,
    setGameMode,
    setWaitingForNextRound,
    readyPlayers, setReadyPlayers,
    setShowCardDealAnimation,
    setDealtCards,
    setIsGameStarted,
    setShowBoardMask,
    setIsSubmitting,
    setSelectedCards,
    getCardColorFromNumber,
    getCardValueFromNumber,
    applySavedSortOrder,
  });

  const isMyTurn = useMemo(() => {
    const room = ColyseusService.getRoom();
    if (!room?.state?.playerOrder) return false;
    const currentPlayerSessionId = room.state.playerOrder[room.state.nowPlayerIndex];
    return currentPlayerSessionId === mySessionId;
  }, [mySessionId, players]);

  const saveSortOrder = (order: number[]) => {
    const room = ColyseusService.getRoom();
    if (room && mySessionId) {
      const sortOrderKey = `sortOrder-${room.roomId}-${mySessionId}`;
      sessionStorage.setItem(sortOrderKey, JSON.stringify(order));
    }
  };

  const handleSort = (sorted: Card[]) => {
    setIsSorting(true);
    saveSortOrder(sorted.map(c => c.originalNumber));

    const offsets: { [key: number]: number } = {};
    sortedHand.forEach((card, currentIndex) => {
      const newIndex = sorted.findIndex(c => c.id === card.id);
      if (newIndex !== currentIndex) {
        const cardWidth = handRef.current?.children[0]?.clientWidth || 0;
        const gap = 6;
        const cardSpacing = cardWidth + gap;
        offsets[card.id] = (newIndex - currentIndex) * cardSpacing;
      }
    });
    
    setCardOffsets(offsets);
    
    setTimeout(() => {
      setSortedHand(sorted);
      setCardOffsets({});
      setIsSorting(false);
    }, 800);
  };

  const handleSortByNumber = () => {
    const sorted = [...sortedHand].sort((a, b) => a.value - b.value);
    handleSort(sorted);
  };

  const handleSortByColor = () => {
    const colorOrder = gameMode === 'easyMode'
      ? ['black', 'bronze','silver', 'gold']
      : ['cloud', 'star', 'moon', 'sun'];
    
    const sorted = [...sortedHand].sort((a, b) => {
      const aIndex = colorOrder.indexOf(a.color);
      const bIndex = colorOrder.indexOf(b.color);
      return aIndex !== bIndex ? aIndex - bIndex : a.value - b.value;
    });
    handleSort(sorted);
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedCard === null) return;
    
    const draggedIndex = sortedHand.findIndex(card => card.id === draggedCard);
    if (draggedIndex === -1 || draggedIndex === dropIndex) return;

    const newHand = [...sortedHand];
    const [draggedItem] = newHand.splice(draggedIndex, 1);
    newHand.splice(dropIndex, 0, draggedItem);
    
    setSortedHand(newHand);
    saveSortOrder(newHand.map(c => c.originalNumber));
    setDraggedCard(null);
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    setSelectedCards([]);
    const room = ColyseusService.getRoom();
    if (room) {
      setPlayers(prev => prev.map(p => p.sessionId === room.sessionId ? { ...p, hasPassed: true } : p));
      room.send('pass');
    }
  };

  const handleSubmitCards = () => {
    if (isSubmitting || !isMyTurn || selectedCards.length === 0) {
      if (isSubmitting) console.log('[DEBUG] handleSubmitCards - 이미 제출 중, 중복 호출 방지');
      if (!isMyTurn) console.log('[DEBUG] handleSubmitCards - 자신의 차례가 아님, 함수 실행 중단');
      return;
    }
    
    setIsSubmitting(true);

    const room = ColyseusService.getRoom();
    if (room) {
      const cardNumbers = selectedCards.map(cardId => {
        const selectedCard = sortedHand.find(c => c.id === cardId);
        if (!selectedCard) {
          console.error('선택된 카드를 찾을 수 없습니다:', cardId);
          return null;
        }
        
        if (selectedCard.originalNumber !== undefined) {
          return selectedCard.originalNumber;
        }
        
        // Fallback for safety
        const myPlayer = room.state.players.get(room.sessionId);
        if (myPlayer && myPlayer.hand) {
          for (const cardNumber of myPlayer.hand) {
            const maxNumber = room.state.maxNumber || 13;
            const color = getCardColorFromNumber(cardNumber, maxNumber);
            const value = getCardValueFromNumber(cardNumber, maxNumber);
            if (color === selectedCard.color && value === selectedCard.value) {
              return cardNumber;
            }
          }
        }
        
        console.error('백엔드에서 카드 번호를 찾을 수 없습니다:', selectedCard);
        return null;
      }).filter((num): num is number => num !== null);

      if (cardNumbers.length !== selectedCards.length) {
        alert('제출할 카드 정보를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.');
        setIsSubmitting(false);
        return;
      }

      const validation = canSubmitCards(cardNumbers);
      if (!validation.canSubmit) {
        alert(`제출 불가: ${validation.reason}`);
        setIsSubmitting(false);
        return;
      }
      
      room.send('submit', { submitCards: cardNumbers });
      setSelectedCards([]);
    } else {
      setIsSubmitting(false);
    }
  };

  const handleModeChange = () => {
    const newMode = gameMode === 'easyMode' ? 'normal' : 'easyMode';
    setGameMode(newMode);
    const room = ColyseusService.getRoom();
    if (room) {
      room.send('easyMode', { easyMode: newMode === 'easyMode' });
    }
  };

  const handleCardSelect = (cardId: number) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleCardDealComplete = () => {
    setShowCardDealAnimation(false);
    setDealtCards(new Set());
    setVisibleHand([...myHand]);
    setSortedHand([...myHand]);
  };

  useEffect(() => {
    if (showCardDealAnimation && dealtCards.size === sortedHand.length && sortedHand.length > 0) {
      const timer = setTimeout(handleCardDealComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [dealtCards, sortedHand, showCardDealAnimation]);

  return {
    players, mySessionId, myHand, sortedHand, visibleHand, gameState, gameMode,
    selectedCards, boardCards, boardSize, showCardDealAnimation, dealtCards,
    isGameStarted, waitingForNextRound, readyPlayers, showBoardMask, isSubmitting,
    draggedCard, isSorting, cardOffsets, handRef, isMyTurn,
    
    setDraggedCard, setDealtCards, setVisibleHand,
    
    handleSortByNumber, handleSortByColor, handleDrop, handlePass, handleSubmitCards,
    handleModeChange, handleCardSelect,
  };
};
