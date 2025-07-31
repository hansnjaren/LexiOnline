import { useEffect, Dispatch, SetStateAction } from 'react';
import ColyseusService from '../../../services/ColyseusService';
import { Player, GameState, Card, BoardCard } from '../types';

type SetPlayers = Dispatch<SetStateAction<Player[]>>;
type SetGameState = Dispatch<SetStateAction<GameState>>;
type SetMyHand = Dispatch<SetStateAction<Card[]>>;
type SetSortedHand = Dispatch<SetStateAction<Card[]>>;
type SetVisibleHand = Dispatch<SetStateAction<Card[]>>;
type SetBoardCards = Dispatch<SetStateAction<BoardCard[]>>;
type SetGameMode = Dispatch<SetStateAction<'easyMode' | 'normal'>>;
type SetWaitingForNextRound = Dispatch<SetStateAction<boolean>>;
type SetReadyPlayers = Dispatch<SetStateAction<Set<string>>>;
type SetShowCardDealAnimation = Dispatch<SetStateAction<boolean>>;
type SetDealtCards = Dispatch<SetStateAction<Set<number>>>;
type SetIsGameStarted = Dispatch<SetStateAction<boolean>>;
type SetShowBoardMask = Dispatch<SetStateAction<boolean>>;
type SetIsSubmitting = Dispatch<SetStateAction<boolean>>;
type SetSelectedCards = Dispatch<SetStateAction<number[]>>;

type ScreenType = 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult';

interface UseColyseusEffectsParams {
  onScreenChange: (screen: ScreenType, data?: any) => void;
  mySessionId: string;
  setMySessionId: Dispatch<SetStateAction<string>>;
  setPlayers: SetPlayers;
  setGameState: SetGameState;
  setMyHand: SetMyHand;
  setSortedHand: SetSortedHand;
  setVisibleHand: SetVisibleHand;
  setBoardCards: SetBoardCards;
  setGameMode: SetGameMode;
  setWaitingForNextRound: SetWaitingForNextRound;
  readyPlayers: Set<string>;
  setReadyPlayers: SetReadyPlayers;
  setShowCardDealAnimation: SetShowCardDealAnimation;
  setDealtCards: SetDealtCards;
  setIsGameStarted: SetIsGameStarted;
  setShowBoardMask: SetShowBoardMask;
  setIsSubmitting: SetIsSubmitting;
  setSelectedCards: SetSelectedCards;
  getCardColorFromNumber: (cardNumber: number, maxNumber: number) => string;
  getCardValueFromNumber: (cardNumber: number, maxNumber: number) => number;
  applySavedSortOrder: (handCards: Card[]) => Card[];
}

export const useColyseusEffects = ({
  onScreenChange,
  mySessionId,
  setMySessionId,
  setPlayers,
  setGameState,
  setMyHand,
  setSortedHand,
  setVisibleHand,
  setBoardCards,
  setGameMode,
  setWaitingForNextRound,
  readyPlayers,
  setReadyPlayers,
  setShowCardDealAnimation,
  setDealtCards,
  setIsGameStarted,
  setShowBoardMask,
  setIsSubmitting,
  setSelectedCards,
  getCardColorFromNumber,
  getCardValueFromNumber,
  applySavedSortOrder,
}: UseColyseusEffectsParams) => {

  const setAndSortHand = (handCards: Card[]) => {
    const sorted = applySavedSortOrder(handCards);
    setMyHand(sorted);
    setSortedHand(sorted);
    setVisibleHand(sorted);
  };

  const syncPlayerRemainingCards = () => {
    const room = ColyseusService.getRoom();
    if (!room) return;
    
    setPlayers(prevPlayers => 
      prevPlayers.map(player => {
        const backendPlayer = room.state.players.get(player.sessionId);
        return {
          ...player,
          remainingTiles: backendPlayer?.hand?.length ?? 0
        };
      })
    );
  };

  useEffect(() => {
    const room = ColyseusService.getRoom();
    if (!room) {
      onScreenChange('lobby');
      return;
    }

    setMySessionId(room.sessionId);
    room.send("requestPlayerInfo");

    if (room.state.round > 1 && !room.state.players.get(room.sessionId)?.readyForNextRound) {
      setWaitingForNextRound(true);
      room.send('requestReadyStatus');
    }

    const handleStateChange = (state: any) => {
      const myPlayer = state.players.get(room.sessionId);
      if (myPlayer) {
        setGameMode(myPlayer.easyMode ? 'easyMode' : 'normal');
      }

      if (state.players && state.playerOrder) {
        const playerList: Player[] = state.playerOrder.map((sessionId: string, index: number) => {
          const player = state.players.get(sessionId);
          return {
            id: index.toString(),
            nickname: player.nickname || '익명',
            score: player.score || 0,
            remainingTiles: player.hand ? player.hand.length : 0,
            isCurrentPlayer: sessionId === room.sessionId,
            sessionId: sessionId,
            hasPassed: player.hasPassed || false
          };
        });
        setPlayers(playerList);
        syncPlayerRemainingCards();

        setGameState(prev => ({
          ...prev,
          lastType: state.lastType || 0,
          lastMadeType: state.lastMadeType || 0,
          lastHighestValue: state.lastHighestValue || -1,
          maxNumber: state.maxNumber || 13,
          round: state.round || 1,
          totalRounds: state.totalRounds || 5
        }));

        if (myPlayer?.hand?.length > 0) {
          const maxNumber = state.maxNumber || 13;
          const handCards = myPlayer.hand.map((cardNumber: number, index: number) => ({
            id: index,
            value: getCardValueFromNumber(cardNumber, maxNumber),
            color: getCardColorFromNumber(cardNumber, maxNumber),
            originalNumber: cardNumber
          }));
          setAndSortHand(handCards);
        }
      }
    };

    room.onStateChange(handleStateChange);

    room.onMessage('gameEnded', (message) => onScreenChange('finalResult', message.finalScores));
    room.onMessage('finalResult', (message) => onScreenChange('finalResult', message.finalScores));
    room.onMessage('roundEnded', (message) => {
      setBoardCards([]);
      onScreenChange('result', message);
    });
    room.onMessage('readyForNextRound', (message) => setReadyPlayers(prev => new Set(prev).add(message.playerId)));
    room.onMessage('allPlayersReadyForNextRound', () => {
      setWaitingForNextRound(false);
      setReadyPlayers(new Set());
    });
    room.onMessage('readyStatusResponse', (message) => setReadyPlayers(new Set(message.readyPlayers as string[])));
    room.onMessage('waitingForNextRound', () => {
      setWaitingForNextRound(true);
      setReadyPlayers(new Set());
      room.send('requestReadyStatus');
    });

    room.onMessage('roundStart', (message) => {
      if (message.hand) {
        const maxNumber = message.maxNumber || 13;
        const handCards = message.hand.map((cardNumber: number, index: number) => ({
          id: index,
          value: getCardValueFromNumber(cardNumber, maxNumber),
          color: getCardColorFromNumber(cardNumber, maxNumber),
          originalNumber: cardNumber
        }));
        setAndSortHand(handCards);
        setShowCardDealAnimation(true);
        setDealtCards(new Set());
        setVisibleHand([]);
      }
    });

    room.onMessage('submitted', (message) => {
      const submittedMaxNumber = room?.state?.maxNumber ?? 13;
      if (message.position) {
        const submittedCards: BoardCard[] = message.cards.map((cardNumber: number, index: number) => ({
          id: Date.now() + index + Math.random(),
          value: getCardValueFromNumber(cardNumber, submittedMaxNumber),
          color: getCardColorFromNumber(cardNumber, submittedMaxNumber),
          originalNumber: cardNumber,
          playerId: message.playerId,
          row: message.position.row,
          col: message.position.col + index,
          isNew: true,
          turnId: message.turnId,
          submitTime: Date.now()
        }));
        setBoardCards(prev => [...prev, ...submittedCards]);
      }

      if (message.playerId === room.sessionId) {
        const myPlayer = room.state.players.get(room.sessionId);
        if (myPlayer?.hand) {
          const maxNumber = room.state.maxNumber || 13;
          const handCards = myPlayer.hand.map((cardNumber: number, index: number) => ({
            id: index,
            value: getCardValueFromNumber(cardNumber, maxNumber),
            color: getCardColorFromNumber(cardNumber, maxNumber),
            originalNumber: cardNumber
          }));
          setAndSortHand(handCards);
        }
      }
      syncPlayerRemainingCards();
      setIsSubmitting(false);
    });

    room.onMessage('pass', () => syncPlayerRemainingCards());
    room.onMessage('playerPassed', (message) => {
      setPlayers(prev => prev.map(p => p.sessionId === message.playerId ? { ...p, hasPassed: message.hasPassed } : p));
    });
    room.onMessage('passReset', () => setPlayers(prev => prev.map(p => ({ ...p, hasPassed: false }))));

    room.onMessage('cycleEnded', () => {
      setBoardCards(prev => prev.map(card => ({ ...card, isNew: false })));
      const myPlayer = room.state.players.get(room.sessionId);
      if (myPlayer && !myPlayer.easyMode) {
        setShowBoardMask(true);
        setTimeout(() => setShowBoardMask(false), 1500);
      }
      setGameState(prev => ({ ...prev, lastType: 0, lastMadeType: 0, lastHighestValue: -1, currentTurnId: prev.currentTurnId + 1 }));
    });

    room.onMessage('turnChanged', (message) => {
      setGameState(prev => ({ ...prev, currentTurnId: prev.currentTurnId + 1 }));
      if (message.allPlayers) {
        const updatedPlayers: Player[] = message.allPlayers.map((p: any) => ({
          id: p.sessionId,
          nickname: p.nickname,
          score: p.score,
          remainingTiles: p.remainingTiles,
          isCurrentPlayer: p.isCurrentPlayer,
          sessionId: p.sessionId,
          hasPassed: p.hasPassed
        }));
        setPlayers(updatedPlayers);
        const isMyTurn = updatedPlayers.find(p => p.isCurrentPlayer)?.sessionId === room.sessionId;
        if (isMyTurn) {
          setSelectedCards([]);
        }
      }
    });

    room.onMessage('submitRejected', (message) => {
      alert('카드 제출이 거부되었습니다: ' + message.reason);
      setIsSubmitting(false);
    });
    room.onMessage('noCard', (message) => {
      alert('보유하지 않은 카드를 제출하려고 했습니다: ' + message.reason);
      setIsSubmitting(false);
    });
    room.onMessage('passRejected', (message) => alert('패스가 거부되었습니다: ' + message.reason));
    room.onMessage('invalidPlayer', (message) => alert('플레이어 정보가 유효하지 않습니다: ' + message.reason));
    room.onMessage('gameStarted', () => setIsGameStarted(true));

    return () => {
      room.onLeave(() => console.log('게임에서 나갔습니다.'));
      room.removeAllListeners();
    };
  }, [mySessionId, onScreenChange]);
};
