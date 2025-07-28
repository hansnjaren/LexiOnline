import { Client, Room } from "colyseus.js";

// UUID 생성 함수
function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

class ColyseusService {
  private client: Client;
  private room: Room | null = null;
  private isConnected: boolean = false;
  private guestId: string;
  private roomInfo: { roomId: string; sessionId: string; nickname: string } | null = null;

  constructor() {
    this.client = new Client("ws://localhost:2567");
    this.guestId = this.getOrCreateGuestId();
  }

  private getOrCreateGuestId(): string {
    let guestId = localStorage.getItem("guestId");
    if (!guestId) {
      guestId = generateUuid();
      localStorage.setItem("guestId", guestId);
    }
    return guestId;
  }

  async connectToRoom(roomName?: string): Promise<Room> {
    try {
      const options = { guestId: this.guestId, roomName };
      if (roomName) {
        this.room = await this.client.join("my_room", options);
      } else {
        this.room = await this.client.joinOrCreate("my_room", { guestId: this.guestId });
      }

      this.isConnected = true;
      this.saveRoomInfo();
      
      this.room.onLeave((code) => {
        console.log("방에서 나갔습니다:", code);
        this.isConnected = false;
        this.room = null;
        this.clearRoomInfo();
      });

      this.room.onError((code, message) => {
        console.error("방 연결 오류:", code, message);
        this.isConnected = false;
        this.clearRoomInfo();
      });

      return this.room;
    } catch (error) {
      console.error("방 연결 실패:", error);
      throw error;
    }
  }

  async createRoom(): Promise<Room> {
    try {
      this.room = await this.client.create("my_room", { guestId: this.guestId });
      this.isConnected = true;
      this.saveRoomInfo();
      
      this.room.onLeave((code) => {
        console.log("방에서 나갔습니다:", code);
        this.isConnected = false;
        this.room = null;
        this.clearRoomInfo();
      });

      this.room.onError((code, message) => {
        console.error("방 연결 오류:", code, message);
        this.isConnected = false;
        this.clearRoomInfo();
      });

      return this.room;
    } catch (error) {
      console.error("방 생성 실패:", error);
      throw error;
    }
  }

  async joinRoom(roomId: string): Promise<Room> {
    try {
      this.room = await this.client.joinById(roomId, { guestId: this.guestId });
      this.isConnected = true;
      this.saveRoomInfo();
      
      this.room.onLeave((code) => {
        console.log("방에서 나갔습니다:", code);
        this.isConnected = false;
        this.room = null;
        this.clearRoomInfo();
      });

      this.room.onError((code, message) => {
        console.error("방 연결 오류:", code, message);
        this.isConnected = false;
        this.clearRoomInfo();
      });

      return this.room;
    } catch (error) {
      console.error("방 참가 실패:", error);
      throw error;
    }
  }

  sendMessage(type: string, data: any) {
    if (this.room && this.isConnected) {
      this.room.send(type, data);
    } else {
      console.warn("방에 연결되지 않았습니다.");
    }
  }

  getRoom(): Room | null {
    return this.room;
  }

  isRoomConnected(): boolean {
    return this.isConnected && this.room !== null;
  }

  disconnect() {
    if (this.room) {
      this.room.leave();
      this.room = null;
      this.isConnected = false;
    }
    this.clearRoomInfo();
  }

  private saveRoomInfo() {
    if (this.room) {
      this.roomInfo = {
        roomId: this.room.roomId,
        sessionId: this.room.sessionId,
        nickname: localStorage.getItem('current_nickname') || ''
      };
      localStorage.setItem('room_info', JSON.stringify(this.roomInfo));
    }
  }

  private clearRoomInfo() {
    this.roomInfo = null;
    localStorage.removeItem('room_info');
  }

  getSavedRoomInfo() {
    if (!this.roomInfo) {
      const saved = localStorage.getItem('room_info');
      if (saved) {
        this.roomInfo = JSON.parse(saved);
      }
    }
    return this.roomInfo;
  }

  async reconnectToSavedRoom(): Promise<Room | null> {
    const savedInfo = this.getSavedRoomInfo();
    if (!savedInfo || !savedInfo.roomId) {
      this.clearRoomInfo();
      return null;
    }

    try {
      console.log(`저장된 방에 재연결 시도 (joinById with guestId): roomId=${savedInfo.roomId}`);
      this.room = await this.client.joinById(savedInfo.roomId, { guestId: this.guestId });
      this.isConnected = true;
      
      if (this.room) {
        this.saveRoomInfo(); // Update session ID in storage
        this.room.onLeave((code) => {
          console.log("방에서 나갔습니다:", code);
          this.isConnected = false;
          this.room = null;
          this.clearRoomInfo();
        });
        this.room.onError((code, message) => {
          console.error("방 연결 오류:", code, message);
          this.isConnected = false;
          this.clearRoomInfo();
        });
      }

      return this.room;
    } catch (error) {
      console.error("저장된 방 재연결 실패:", error);
      this.clearRoomInfo();
      return null;
    }
  }
}

export default new ColyseusService();
