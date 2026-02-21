import type { BattleTransport, BattleTransportEvents } from "./battle-transport";
import type { ActionType } from "@nfc-card-battle/shared";
import { getSocket } from "./socket";

// Socket.io版バトルトランスポート
export class SocketTransport implements BattleTransport {
  private events: BattleTransportEvents | null = null;

  connect(events: BattleTransportEvents): void {
    this.events = events;
    const socket = getSocket();
    if (!socket) return;

    socket.on("card_registered", (data) => {
      this.events?.onCardRegistered(data);
    });
    socket.on("opponent_card_registered", (data) => {
      this.events?.onOpponentCardRegistered(data);
    });
    socket.on("battle_start", (data) => {
      this.events?.onBattleStart(data);
    });
    socket.on("turn_result", (data) => {
      this.events?.onTurnResult(data);
    });
    socket.on("battle_end", (data) => {
      this.events?.onBattleEnd(data);
    });
    socket.on("opponent_disconnected", () => {
      this.events?.onOpponentDisconnected();
    });
    socket.on("error", (data) => {
      this.events?.onError(data);
    });
  }

  disconnect(): void {
    const socket = getSocket();
    if (socket) {
      socket.off("card_registered");
      socket.off("opponent_card_registered");
      socket.off("battle_start");
      socket.off("turn_result");
      socket.off("battle_end");
      socket.off("opponent_disconnected");
      socket.off("error");
    }
    this.events = null;
  }

  registerCard(cardUid: string, token?: string): void {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("register_card", { cardUid, token: token ?? "" });
  }

  selectAction(action: ActionType): void {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("select_action", { action });
  }

  leaveRoom(): void {
    const socket = getSocket();
    if (!socket) return;
    socket.emit("leave_room");
  }
}
