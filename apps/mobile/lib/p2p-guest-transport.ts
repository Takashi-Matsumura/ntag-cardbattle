import type { Character, ActionType } from "@nfc-card-battle/shared";
import { getEffectiveStats } from "@nfc-card-battle/shared";
import type { BattleTransport, BattleTransportEvents } from "./battle-transport";
import type { HostToGuestMessage, GuestToHostMessage } from "./p2p-protocol";
import * as MC from "../modules/multipeer-connectivity/src";
import type { LocalCardData } from "./local-cards";
import { getCharacterBase } from "./local-cards";

// ゲスト側P2Pトランスポート（アクション送信 + 結果受信のみ）
export class P2PGuestTransport implements BattleTransport {
  private events: BattleTransportEvents | null = null;
  private peerConnectedSub: { remove(): void } | null = null;
  private peerDisconnectedSub: { remove(): void } | null = null;
  private dataReceivedSub: { remove(): void } | null = null;

  private displayName: string;

  constructor(displayName: string) {
    this.displayName = displayName;
  }

  connect(events: BattleTransportEvents): void {
    this.events = events;

    this.peerConnectedSub = MC.addPeerConnectedListener(() => {
      // ホストに接続完了
    });

    this.peerDisconnectedSub = MC.addPeerDisconnectedListener(() => {
      this.events?.onOpponentDisconnected();
    });

    this.dataReceivedSub = MC.addDataReceivedListener(({ data }) => {
      const msg: HostToGuestMessage = JSON.parse(data);
      this.handleHostMessage(msg);
    });

    MC.startGuest(this.displayName);
  }

  disconnect(): void {
    this.peerConnectedSub?.remove();
    this.peerDisconnectedSub?.remove();
    this.dataReceivedSub?.remove();
    MC.disconnect();
    this.events = null;
  }

  // ゲスト用: ローカルカードデータをホストに送信
  registerCard(cardUid: string): void {
    // registerLocalCardを使用すること
  }

  // ゲスト用: ローカルカードデータからカード登録
  registerLocalCard(localCard: LocalCardData): void {
    const base = getCharacterBase(localCard.characterId);
    if (!base) {
      this.events?.onError({ message: "キャラクターデータが見つかりません" });
      return;
    }

    // ベースステータス（レベル補正はホスト側で適用）
    const character: Character = {
      id: localCard.characterId,
      name: base.name,
      hp: base.hp,
      attack: base.attack,
      defense: base.defense,
      imageUrl: null,
    };

    this.sendToHost({
      type: "register_card",
      cardUid: localCard.cardUid,
      character,
      level: localCard.level,
      exp: localCard.exp,
      totalWins: localCard.totalWins,
      totalLosses: localCard.totalLosses,
    });
  }

  selectAction(action: ActionType): void {
    this.sendToHost({ type: "select_action", action });
  }

  leaveRoom(): void {
    this.disconnect();
  }

  private handleHostMessage(msg: HostToGuestMessage): void {
    switch (msg.type) {
      case "card_registered":
        this.events?.onCardRegistered(msg);
        break;
      case "opponent_card_registered":
        this.events?.onOpponentCardRegistered(msg);
        break;
      case "battle_start":
        this.events?.onBattleStart(msg);
        break;
      case "turn_result":
        this.events?.onTurnResult(msg.result);
        break;
      case "battle_end":
        this.events?.onBattleEnd(msg.data);
        break;
      case "error":
        this.events?.onError({ message: msg.message });
        break;
    }
  }

  private sendToHost(msg: GuestToHostMessage): void {
    MC.sendData(JSON.stringify(msg));
  }
}
