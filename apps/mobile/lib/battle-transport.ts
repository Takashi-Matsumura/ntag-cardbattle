import type {
  Character,
  TurnResult,
  TurnType,
  ActionType,
  BattleEndData,
} from "@nfc-card-battle/shared";

// バトルトランスポートのイベントコールバック
export interface BattleTransportEvents {
  onCardRegistered: (data: { card: Character; role: "A" | "B"; level: number }) => void;
  onOpponentCardRegistered: (data: { card: Character; level: number }) => void;
  onBattleStart: (data: {
    turn: number;
    timeLimit: number;
    turnType: TurnType;
    role: "A" | "B";
    specialCd: number;
  }) => void;
  onTurnResult: (data: TurnResult) => void;
  onBattleEnd: (data: BattleEndData) => void;
  onOpponentDisconnected: () => void;
  onError: (data: { message: string }) => void;
}

// バトルトランスポートインターフェース（Socket.io / P2P共通）
export interface BattleTransport {
  connect(events: BattleTransportEvents): void;
  disconnect(): void;
  registerCard(cardUid: string, token?: string): void;
  selectAction(action: ActionType): void;
  leaveRoom(): void;
}
