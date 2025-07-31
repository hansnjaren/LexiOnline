import { Client, Room } from "colyseus.js";
import { GameState, Player, Card, BoardCard } from "../components/GameScreen/types";
import { getCardColorFromNumber, getCardValueFromNumber } from "../components/GameScreen/cardUtils";

type ScreenType = 'lobby' | 'waiting' | 'game' | 'result' | 'finalResult';
type GameStateSubscriber = (state: GameStateContainer) => void;
type ScreenChangeSubscriber = (screen: ScreenType, data?: any) => void;

export interface GameStateContainer {
  players: Player[];
  mySessionId: string;
  myHand: Card[];
  sortedHand: Card[];
  visibleHand: Card[];
  gameState: GameState;
  gameMode: 'easyMode' | 'normal';
  boardCards: BoardCard[];
  waitingForNextRound: boolean;
  readyPlayers: Set<string>;
  showCardDealAnimation: boolean;
  dealtCards: Set<number>;
  isGameStarted: boolean;
  showBoardMask: boolean;
  isSubmitting: boolean;
}

class ColyseusService {
  private client: Client;
  private room: Room | null = null;
  
  public state: GameStateContainer;
  private subscribers: Set<GameStateSubscriber> = new Set();
  private screenChangeSubscribers: Set<ScreenChangeSubscriber> = new Set();
  private roomInfo: { roomId: string; sessionId: string; nickname: string } | null = null;

  constructor() {
    this.client = new Client("ws://localhost:2567");
    this.state = this.getInitialState();
  }

  private getInitialState(): GameStateContainer {
    return {
      players: [],
      mySessionId: '',
      myHand: [],
      sortedHand: [],
      visibleHand: [],
      gameState: {
        lastType: 0,
        lastMadeType: 0,
        lastHighestValue: -1,
        currentTurnId: 0,
        maxNumber: 13,
        round: 1,
        totalRounds: 5
      },
      gameMode: 'easyMode',
      boardCards: [],
      waitingForNextRound: false,
      readyPlayers: new Set(),
      showCardDealAnimation: false,
      dealtCards: new Set(),
      isGameStarted: false,
      showBoardMask: false,
      isSubmitting: false,
    };
  }

  // --- Pub/Sub Methods ---
  subscribe(callback: GameStateSubscriber) {
    this.subscribers.add(callback);
    return () => { this.unsubscribe(callback); };
  }

  unsubscribe(callback: GameStateSubscriber) {
    this.subscribers.delete(callback);
  }

  subscribeScreenChange(callback: ScreenChangeSubscriber) {
    this.screenChangeSubscribers.add(callback);
    return () => { this.screenChangeSubscribers.delete(callback); };
  }

  private notifyScreenChange(screen: ScreenType, data?: any) {
    this.screenChangeSubscribers.forEach(callback => callback(screen, data));
  }

  private notify() {
    this.subscribers.forEach(callback => callback(this.state));
  }

  private setState(newState: Partial<GameStateContainer>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  // --- Connection Methods ---
  private async setupRoom(room: Room) {
    this.room = room;
    this.setState({ mySessionId: room.sessionId });
    this.initializeListeners();
    this.saveRoomInfo();

    room.onLeave(() => {
      this.room = null;
      this.state = this.getInitialState();
      this.clearRoomInfo();
      this.notify();
    });
  }

  async joinOrCreate(options: any = {}): Promise<Room> {
    try {
      const room = await this.client.joinOrCreate("my_room", options);
      await this.setupRoom(room);
      return room;
    } catch (error) {
      console.error("방 생성 또는 참가 실패:", error);
      throw error;
    }
  }

  async createRoom(options: any = {}): Promise<Room> {
    try {
      const room = await this.client.create("my_room", options);
      await this.setupRoom(room);
      return room;
    } catch (error) {
      console.error("방 생성 실패:", error);
      throw error;
    }
  }

  async joinRoom(roomId: string, options: any = {}): Promise<Room> {
    try {
      const room = await this.client.joinById(roomId, options);
      await this.setupRoom(room);
      return room;
    } catch (error) {
      console.error("방 참가 실패:", error);
      throw error;
    }
  }

  getRoom(): Room | null {
    return this.room;
  }

  disconnect() {
    if (this.room) {
      this.room.leave();
    }
  }

  public cardDealAnimationComplete() {
    this.setState({ showCardDealAnimation: false });
  }

  public submitCards(cardNumbers: number[]) {
    if (this.room) {
      this.setState({ isSubmitting: true });
      this.room.send('submit', { submitCards: cardNumbers });
    }
  }
  
  // --- Room Info ---
  private saveRoomInfo() {
    if (this.room) {
      this.roomInfo = {
        roomId: this.room.roomId,
        sessionId: this.room.sessionId,
        nickname: sessionStorage.getItem('current_nickname') || ''
      };
      sessionStorage.setItem('room_info', JSON.stringify(this.roomInfo));
    }
  }

  private clearRoomInfo() {
    this.roomInfo = null;
    sessionStorage.removeItem('room_info');
  }

  getSavedRoomInfo() {
    if (!this.roomInfo) {
      const saved = sessionStorage.getItem('room_info');
      if (saved) {
        this.roomInfo = JSON.parse(saved);
      }
    }
    return this.roomInfo;
  }

  async reconnectToSavedRoom(): Promise<Room | null> {
    const savedInfo = this.getSavedRoomInfo();
    if (!savedInfo) return null;

    try {
      const room = await this.client.joinById(savedInfo.roomId, { sessionId: savedInfo.sessionId });
      await this.setupRoom(room);
      return room;
    } catch (error) {
      console.error("재연결 실패:", error);
      this.clearRoomInfo();
      return null;
    }
  }

  // --- Listener Initialization ---
  private initializeListeners() {
    if (!this.room) return;

    const room = this.room;

    const applySavedSortOrder = (handCards: Card[]): Card[] => {
        const sortOrderKey = `sortOrder-${room.roomId}-${this.state.mySessionId}`;
        const savedOrderJSON = sessionStorage.getItem(sortOrderKey);
        if (savedOrderJSON) {
            try {
                const savedOrder: number[] = JSON.parse(savedOrderJSON);
                const handCardMap = new Map(handCards.map(card => [card.originalNumber, card]));
                const sorted = savedOrder.map(num => handCardMap.get(num)).filter((c): c is Card => !!c);
                const remaining = handCards.filter(c => !savedOrder.includes(c.originalNumber));
                return [...sorted, ...remaining];
            } catch (e) {
                sessionStorage.removeItem(sortOrderKey);
            }
        }
        return handCards;
    };

    const setAndSortHand = (handCards: Card[]) => {
        const sorted = applySavedSortOrder(handCards);
        this.setState({ myHand: sorted, sortedHand: sorted, visibleHand: sorted });
    };
    
    const syncPlayerRemainingCards = () => {
        if (!this.room || !this.room.state) return;
        const updatedPlayers = this.state.players.map(player => {
            const backendPlayer = this.room!.state.players.get(player.sessionId);
            return { ...player, remainingTiles: backendPlayer?.hand?.length ?? 0 };
        });
        this.setState({ players: updatedPlayers });
    };

    room.onStateChange((state) => {
        const myPlayer = state.players.get(room.sessionId);
        const newPlayers: Player[] = [];
        if (state.players && state.playerOrder) {
            const currentPlayerSessionId = state.playerOrder[state.nowPlayerIndex];
            state.playerOrder.forEach((sessionId: string, index: number) => {
                const player = state.players.get(sessionId);
                if (player) {
                    newPlayers.push({
                        id: index.toString(),
                        nickname: player.nickname || '익명',
                        score: player.score || 0,
                        remainingTiles: player.hand ? player.hand.length : 0,
                        isCurrentPlayer: sessionId === currentPlayerSessionId,
                        sessionId: sessionId,
                        hasPassed: player.hasPassed || false
                    });
                }
            });
        }

        const newGameState = {
            lastType: state.lastType,
            lastMadeType: state.lastMadeType,
            lastHighestValue: state.lastHighestValue,
            currentTurnId: state.currentTurnId,
            maxNumber: state.maxNumber,
            round: state.round,
            totalRounds: state.totalRounds
        };

        this.setState({
            players: newPlayers,
            gameState: newGameState,
            gameMode: myPlayer?.easyMode ? 'easyMode' : 'normal'
        });

        // Unconditionally sync hand state from server
        const handCards = myPlayer?.hand.map((cardNum: number, i: number) => ({
            id: i,
            value: getCardValueFromNumber(cardNum, state.maxNumber),
            color: getCardColorFromNumber(cardNum, state.maxNumber),
            originalNumber: cardNum
        })) || [];
        setAndSortHand(handCards);
    });

    room.onMessage('roundStart', (message) => {
        if (message.hand) {
            const handCards = message.hand.map((cardNum: number, i: number) => ({
                id: i,
                value: getCardValueFromNumber(cardNum, message.maxNumber),
                color: getCardColorFromNumber(cardNum, message.maxNumber),
                originalNumber: cardNum
            }));
            setAndSortHand(handCards);
            this.setState({ showCardDealAnimation: true, dealtCards: new Set(), visibleHand: [] });
        }
    });
    
    room.onMessage('allPlayersReadyForNextRound', () => {
        this.setState({ waitingForNextRound: false, readyPlayers: new Set() });
    });

    room.onMessage('waitingForNextRound', () => {
        this.setState({ waitingForNextRound: true, readyPlayers: new Set() });
        this.room?.send('requestReadyStatus');
    });

    room.onMessage('readyForNextRound', (message) => {
        const newReadyPlayers = new Set(this.state.readyPlayers);
        newReadyPlayers.add(message.playerId);
        this.setState({ readyPlayers: newReadyPlayers });
    });

    room.onMessage('readyStatusResponse', (message) => {
        this.setState({ readyPlayers: new Set(message.readyPlayers as string[]) });
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
            this.setState({ boardCards: [...this.state.boardCards, ...submittedCards] });
        }
        // Hand updates are handled by onStateChange
        syncPlayerRemainingCards();
        this.setState({ isSubmitting: false });
    });

    room.onMessage('submitRejected', (message) => {
      alert('카드 제출이 거부되었습니다: ' + message.reason);
      this.setState({ isSubmitting: false });
    });

    room.onMessage('roundEnded', (message) => {
        this.setState({ boardCards: [] });
        this.notifyScreenChange('result', message);
    });

    room.onMessage('gameEnded', (message) => {
        this.notifyScreenChange('finalResult', message.finalScores);
    });

    room.onMessage('finalResult', (message) => {
        this.notifyScreenChange('finalResult', message.finalScores);
    });
  }
}

export default new ColyseusService();
