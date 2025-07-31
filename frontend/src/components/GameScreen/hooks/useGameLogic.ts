import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import ColyseusService, { GameStateContainer } from '../../../services/ColyseusService';
import { Player, Card, BoardCard, GameState } from '../types';
import { useCardUtils } from './useCardUtils';

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

  useEffect(() => {
    const handleStateChange = (newState: GameStateContainer) => {
      setPlayers(newState.players);
      setMySessionId(newState.mySessionId);
      setMyHand(newState.myHand);
      setSortedHand(newState.sortedHand);
      setVisibleHand(newState.visibleHand);
      setGameState(newState.gameState);
      setGameMode(newState.gameMode);
      setBoardCards(newState.boardCards);
      // boardSize is not part of the service state yet, so we don't set it here.
      setWaitingForNextRound(newState.waitingForNextRound);
      setReadyPlayers(newState.readyPlayers);
      setShowCardDealAnimation(newState.showCardDealAnimation);
      setIsGameStarted(newState.isGameStarted);
      setShowBoardMask(newState.showBoardMask);
    };

    const unsubscribe = ColyseusService.subscribe(handleStateChange);
    
    // Set initial state
    handleStateChange(ColyseusService.state);

    return () => {
      unsubscribe();
    };
  }, []);


  const isMyTurn = useMemo(() => {
    const me = players.find(p => p.sessionId === mySessionId);
    return me?.isCurrentPlayer || false;
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
    ColyseusService.getRoom()?.send('pass');
  };

  const handleSubmitCards = () => {
    if (isSubmitting || !isMyTurn || selectedCards.length === 0) return;
    
    const cardNumbers = selectedCards.map(cardId => {
      const card = sortedHand.find(c => c.id === cardId);
      return card?.originalNumber;
    }).filter((num): num is number => num !== undefined);

    const validation = canSubmitCards(cardNumbers);
    if (!validation.canSubmit) {
      alert(`제출 불가: ${validation.reason}`);
      return;
    }
    
    ColyseusService.submitCards(cardNumbers);
    setSelectedCards([]);
  };

  const handleModeChange = () => {
    const newMode = gameMode === 'easyMode' ? 'normal' : 'easyMode';
    ColyseusService.getRoom()?.send('easyMode', { easyMode: newMode === 'easyMode' });
  };

  const handleCardSelect = (cardId: number) => {
    setSelectedCards(prev => 
      prev.includes(cardId) 
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const handleCardDealComplete = () => {
    ColyseusService.cardDealAnimationComplete();
  };

  return {
    players, mySessionId, myHand, sortedHand, visibleHand, gameState, gameMode,
    selectedCards, boardCards, boardSize,
    isGameStarted, waitingForNextRound, readyPlayers, showBoardMask, isSubmitting,
    draggedCard, isSorting, cardOffsets, handRef, isMyTurn, showCardDealAnimation, dealtCards,
    
    setDraggedCard, setDealtCards, setVisibleHand,
    
    handleSortByNumber, handleSortByColor, handleDrop, handlePass, handleSubmitCards,
    handleModeChange, handleCardSelect, handleCardDealComplete,
  };
};
