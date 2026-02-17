// --- キャラクター画像 ---
export const CHARACTER_IMAGE_TYPES = [
  "idle",
  "attack",
  "defend",
  "special",
  "damaged",
] as const;

export type CharacterImageType = (typeof CHARACTER_IMAGE_TYPES)[number];

// --- カード関連 ---
export interface Character {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  imageUrl: string | null;
}

export interface Card {
  id: string; // NTAG UID
  character: Character | null;
}

// --- バトル関連 ---
export type ActionType = "attack" | "defend" | "special" | "counter" | "timeout";

export type TurnType = "A_attacks" | "B_attacks";

export type ResultType =
  | "deal"
  | "defend"
  | "perfect"
  | "counter_ok"
  | "counter_fail"
  | "penalty"
  | "no_guard";

export interface TurnResult {
  turn: number;
  turnType: TurnType;
  attackerRole: "A" | "B";
  attackerAction: ActionType;
  defenderAction: ActionType;
  damageToDefender: number;
  damageToAttacker: number;
  resultType: ResultType;
  playerA: { hpAfter: number; specialCd: number };
  playerB: { hpAfter: number; specialCd: number };
}

export type BattleStatus = "waiting" | "ready" | "battle" | "finished";

export interface BattleState {
  roomCode: string;
  status: BattleStatus;
  playerA: { card: Character; hp: number } | null;
  playerB: { card: Character; hp: number } | null;
  currentTurn: number;
  turnType: TurnType;
}

// --- Socket.io イベント ---
export interface ClientToServerEvents {
  create_room: () => void;
  join_room: (data: { roomCode: string }) => void;
  register_card: (data: { cardUid: string }) => void;
  select_action: (data: { action: ActionType }) => void;
  leave_room: () => void;
}

export interface ServerToClientEvents {
  room_created: (data: { roomCode: string }) => void;
  opponent_joined: () => void;
  card_registered: (data: { card: Character; role: "A" | "B" }) => void;
  opponent_card_registered: (data: { card: Character }) => void;
  battle_start: (data: {
    turn: number;
    timeLimit: number;
    turnType: TurnType;
    role: "A" | "B";
    specialCd: number;
  }) => void;
  turn_result: (data: TurnResult) => void;
  battle_end: (data: { winner: "A" | "B"; finalState: BattleState }) => void;
  opponent_disconnected: () => void;
  error: (data: { message: string }) => void;
}
