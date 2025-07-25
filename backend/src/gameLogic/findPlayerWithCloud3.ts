// src.findPlayerWithCloud3.ts
import { PlayerState } from "../rooms/schema/PlayerState";
import { MapSchema } from "@colyseus/schema"

export function findPlayerWithCloud3(
  players: MapSchema<PlayerState>, 
  maxNumber: number
): string | null {
  for (const [sessionId, player] of players.entries()) {
    for (const card of player.hand) {
      const type = Math.floor(card / maxNumber);
      const number = (card + maxNumber - 2) % maxNumber;

      if (type === 0 && number === 0) { // 구름 3: type=0, 내부 number=0
        return sessionId;
      }
    }
  }
  return null; // 못찾으면 null 반환
}
