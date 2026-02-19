import type {
  ActionType,
  BattleState,
  Character,
  TurnType,
} from "@nfc-card-battle/shared";

interface PlayerSlot {
  socketId: string;
  card: Character | null;
  cardUid: string | null;
  cardLevel: number;
  cardExp: number;
  cardWins: number;
  cardLosses: number;
  action: ActionType | null;
  specialCd: number;
}

export interface Room {
  code: string;
  state: BattleState;
  playerA: PlayerSlot;
  playerB: PlayerSlot | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  turnProcessing: boolean;
}

class RoomManager {
  private rooms = new Map<string, Room>();

  // 6桁のルームコード生成
  private generateCode(): string {
    let code: string;
    do {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(code));
    return code;
  }

  // ルーム作成
  createRoom(socketId: string): Room {
    const code = this.generateCode();
    const room: Room = {
      code,
      state: {
        roomCode: code,
        status: "waiting",
        playerA: null,
        playerB: null,
        currentTurn: 0,
        turnType: "A_attacks",
      },
      playerA: { socketId, card: null, cardUid: null, cardLevel: 1, cardExp: 0, cardWins: 0, cardLosses: 0, action: null, specialCd: 0 },
      playerB: null,
      turnTimer: null,
      turnProcessing: false,
    };
    this.rooms.set(code, room);
    return room;
  }

  // ルーム参加
  joinRoom(code: string, socketId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (room.playerB) return null; // 満室

    room.playerB = { socketId, card: null, cardUid: null, cardLevel: 1, cardExp: 0, cardWins: 0, cardLosses: 0, action: null, specialCd: 0 };
    return room;
  }

  // ルーム取得
  getRoom(code: string): Room | null {
    return this.rooms.get(code) ?? null;
  }

  // ソケットIDからルーム検索
  findRoomBySocket(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (
        room.playerA.socketId === socketId ||
        room.playerB?.socketId === socketId
      ) {
        return room;
      }
    }
    return null;
  }

  // プレイヤー判定（A or B）
  getPlayerRole(
    room: Room,
    socketId: string
  ): "A" | "B" | null {
    if (room.playerA.socketId === socketId) return "A";
    if (room.playerB?.socketId === socketId) return "B";
    return null;
  }

  // アクション設定
  setAction(room: Room, role: "A" | "B", action: ActionType) {
    if (role === "A") {
      room.playerA.action = action;
    } else if (room.playerB) {
      room.playerB.action = action;
    }
  }

  // 両者のアクションが揃ったか
  bothActionsReady(room: Room): boolean {
    return room.playerA.action !== null && room.playerB?.action !== null;
  }

  // アクションリセット
  resetActions(room: Room) {
    room.playerA.action = null;
    if (room.playerB) room.playerB.action = null;
  }

  // ターンタイプの切り替え
  toggleTurnType(room: Room): TurnType {
    const next: TurnType =
      room.state.turnType === "A_attacks" ? "B_attacks" : "A_attacks";
    room.state.turnType = next;
    return next;
  }

  // カードUIDが他ルームで使用中か確認
  isCardUidInUse(cardUid: string): boolean {
    for (const room of this.rooms.values()) {
      if (
        room.playerA.cardUid === cardUid ||
        room.playerB?.cardUid === cardUid
      ) {
        return true;
      }
    }
    return false;
  }

  // ルーム削除
  removeRoom(code: string) {
    const room = this.rooms.get(code);
    if (room?.turnTimer) {
      clearTimeout(room.turnTimer);
    }
    this.rooms.delete(code);
  }
}

export const roomManager = new RoomManager();
