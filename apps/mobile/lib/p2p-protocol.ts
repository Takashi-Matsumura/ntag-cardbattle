import type {
  Character,
  TurnResult,
  TurnType,
  ActionType,
  BattleEndData,
} from "@nfc-card-battle/shared";

// P2Pメッセージの型定義（ホスト↔ゲスト間のJSON通信）

// ゲスト → ホスト
export type GuestToHostMessage =
  | { type: "register_card"; cardUid: string; character: Character; level: number; exp: number; totalWins: number; totalLosses: number }
  | { type: "select_action"; action: ActionType };

// ホスト → ゲスト
export type HostToGuestMessage =
  | { type: "card_registered"; card: Character; role: "A" | "B"; level: number }
  | { type: "opponent_card_registered"; card: Character; level: number }
  | { type: "battle_start"; turn: number; timeLimit: number; turnType: TurnType; role: "A" | "B"; specialCd: number }
  | { type: "turn_result"; result: TurnResult }
  | { type: "battle_end"; data: BattleEndData }
  | { type: "error"; message: string };
