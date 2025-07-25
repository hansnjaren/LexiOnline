// src/rooms/schema/MyRoomState.ts
import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class MyRoomState extends Schema {

  @type("string") host = "";

  @type("int8") lastPlayerIndex = 0;

  @type("int8") lastHighestValue = 0; // order decision

  @type("int8") lastType = 0; // 0: starting, 1: single, 2: pair, 3: triple, 5: made

  @type("int8") lastMadeType = 0; // 0: not made, 1: straight, 2: flush, 3: full house, 4: four cards, 5: straight flush

  @type([ "int8" ]) lastCards = new ArraySchema<number>();

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  @type([ "string" ]) playerOrder = new ArraySchema<string>();

  @type("int8") totalRounds = 5;

  @type("int8") round = 0;

  @type("boolean") easyMode = false;

  @type("int8") nowPlayerIndex = 0;

  @type("int8") maxNumber = 0;

}
