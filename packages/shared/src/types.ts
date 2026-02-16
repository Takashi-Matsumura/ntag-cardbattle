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
export type ActionType = "attack" | "defend";

export interface TurnResult {
  turn: number;
  playerA: { action: ActionType; damageTaken: number; hpAfter: number };
  playerB: { action: ActionType; damageTaken: number; hpAfter: number };
}

export type BattleStatus = "waiting" | "ready" | "battle" | "finished";

export interface BattleState {
  roomCode: string;
  status: BattleStatus;
  playerA: { card: Character; hp: number } | null;
  playerB: { card: Character; hp: number } | null;
  currentTurn: number;
}

// --- Socket.io イベント ---
export interface ClientToServerEvents {
  create_room: () => void;
  join_room: (data: { roomCode: string }) => void;
  register_card: (data: { cardUid: string }) => void;
  select_action: (data: { action: ActionType }) => void;
}

export interface ServerToClientEvents {
  room_created: (data: { roomCode: string }) => void;
  opponent_joined: () => void;
  card_registered: (data: { card: Character }) => void;
  opponent_card_registered: (data: { card: Character }) => void;
  battle_start: (data: { turn: number; timeLimit: number }) => void;
  turn_result: (data: TurnResult) => void;
  battle_end: (data: { winner: "A" | "B"; finalState: BattleState }) => void;
  opponent_disconnected: () => void;
  error: (data: { message: string }) => void;
}
