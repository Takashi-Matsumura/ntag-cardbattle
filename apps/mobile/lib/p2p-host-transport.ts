import type {
  Character,
  TurnType,
  ActionType,
  BattleEndData,
} from "@nfc-card-battle/shared";
import {
  TURN_TIME_LIMIT,
  resolveTurnBased,
  calcLevel,
  calcExpGain,
  getEffectiveStats,
} from "@nfc-card-battle/shared";
import type { BattleTransport, BattleTransportEvents } from "./battle-transport";
import type { GuestToHostMessage, HostToGuestMessage } from "./p2p-protocol";
import * as MC from "../modules/multipeer-connectivity/src";
import type { LocalCardData } from "./local-cards";
import { getCharacterBase, saveLocalCard } from "./local-cards";

interface PlayerSlot {
  card: Character | null;
  level: number;
  exp: number;
  wins: number;
  losses: number;
  hp: number;
  action: ActionType | null;
  specialCd: number;
}

// ホスト側P2Pトランスポート（バトルエンジン実行）
export class P2PHostTransport implements BattleTransport {
  private events: BattleTransportEvents | null = null;
  private peerConnectedSub: { remove(): void } | null = null;
  private peerDisconnectedSub: { remove(): void } | null = null;
  private dataReceivedSub: { remove(): void } | null = null;
  private guestConnected = false;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private currentTurn = 0;
  private currentTurnType: TurnType = "A_attacks";
  private turnProcessing = false;

  // ホスト = Player A
  private playerA: PlayerSlot = {
    card: null, level: 1, exp: 0, wins: 0, losses: 0,
    hp: 0, action: null, specialCd: 0,
  };
  // ゲスト = Player B
  private playerB: PlayerSlot = {
    card: null, level: 1, exp: 0, wins: 0, losses: 0,
    hp: 0, action: null, specialCd: 0,
  };

  private displayName: string;

  constructor(displayName: string) {
    this.displayName = displayName;
  }

  connect(events: BattleTransportEvents): void {
    this.events = events;

    this.peerConnectedSub = MC.addPeerConnectedListener(() => {
      this.guestConnected = true;
    });

    this.peerDisconnectedSub = MC.addPeerDisconnectedListener(() => {
      this.guestConnected = false;
      this.events?.onOpponentDisconnected();
    });

    this.dataReceivedSub = MC.addDataReceivedListener(({ data }) => {
      const msg: GuestToHostMessage = JSON.parse(data);
      this.handleGuestMessage(msg);
    });

    MC.startHost(this.displayName);
  }

  disconnect(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.peerConnectedSub?.remove();
    this.peerDisconnectedSub?.remove();
    this.dataReceivedSub?.remove();
    MC.disconnect();
    this.events = null;
  }

  // ホスト自身のカード登録
  registerCard(cardUid: string): void {
    // ローカルカードデータからキャラクター情報を取得（呼び出し側で事前にセット）
  }

  // ホスト用: ローカルカードデータから直接登録
  registerLocalCard(localCard: LocalCardData): void {
    const base = getCharacterBase(localCard.characterId);
    if (!base) {
      this.events?.onError({ message: "キャラクターデータが見つかりません" });
      return;
    }

    const stats = getEffectiveStats(base.hp, base.attack, base.defense, localCard.level);
    const character: Character = {
      id: localCard.characterId,
      name: base.name,
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      imageUrl: null,
    };

    this.playerA = {
      card: character,
      level: localCard.level,
      exp: localCard.exp,
      wins: localCard.totalWins,
      losses: localCard.totalLosses,
      hp: character.hp,
      action: null,
      specialCd: 0,
    };

    // 自分にカード情報を通知
    this.events?.onCardRegistered({ card: character, role: "A", level: localCard.level });

    // ゲストに通知
    this.sendToGuest({
      type: "opponent_card_registered",
      card: character,
      level: localCard.level,
    });

    this.tryStartBattle();
  }

  selectAction(action: ActionType): void {
    this.playerA.action = action;
    if (this.playerA.action !== null && this.playerB.action !== null) {
      this.processTurn();
    }
  }

  leaveRoom(): void {
    this.disconnect();
  }

  private handleGuestMessage(msg: GuestToHostMessage): void {
    switch (msg.type) {
      case "register_card": {
        const stats = getEffectiveStats(
          msg.character.hp, msg.character.attack, msg.character.defense, msg.level
        );
        const character: Character = {
          ...msg.character,
          hp: stats.hp,
          attack: stats.attack,
          defense: stats.defense,
        };

        this.playerB = {
          card: character,
          level: msg.level,
          exp: msg.exp,
          wins: msg.totalWins,
          losses: msg.totalLosses,
          hp: character.hp,
          action: null,
          specialCd: 0,
        };

        // ゲストに登録完了を通知
        this.sendToGuest({
          type: "card_registered",
          card: character,
          role: "B",
          level: msg.level,
        });

        // ホストに相手カード情報を通知
        this.events?.onOpponentCardRegistered({ card: character, level: msg.level });

        this.tryStartBattle();
        break;
      }
      case "select_action": {
        this.playerB.action = msg.action;
        if (this.playerA.action !== null && this.playerB.action !== null) {
          this.processTurn();
        }
        break;
      }
    }
  }

  private tryStartBattle(): void {
    if (this.playerA.card && this.playerB.card) {
      this.startTurn();
    }
  }

  private startTurn(): void {
    this.currentTurn++;
    this.playerA.action = null;
    this.playerB.action = null;
    this.turnProcessing = false;

    if (this.currentTurn > 1) {
      this.currentTurnType = this.currentTurnType === "A_attacks" ? "B_attacks" : "A_attacks";
    }

    // ホストに通知
    this.events?.onBattleStart({
      turn: this.currentTurn,
      timeLimit: TURN_TIME_LIMIT,
      turnType: this.currentTurnType,
      role: "A",
      specialCd: this.playerA.specialCd,
    });

    // ゲストに通知
    this.sendToGuest({
      type: "battle_start",
      turn: this.currentTurn,
      timeLimit: TURN_TIME_LIMIT,
      turnType: this.currentTurnType,
      role: "B",
      specialCd: this.playerB.specialCd,
    });

    // タイムアウト処理
    this.turnTimer = setTimeout(() => {
      const attackerRole = this.currentTurnType === "A_attacks" ? "A" : "B";
      if (attackerRole === "A" && this.playerA.action === null) {
        this.playerA.action = "timeout";
      } else if (attackerRole === "B" && this.playerB.action === null) {
        this.playerB.action = "timeout";
      }
      const defenderRole = attackerRole === "A" ? "B" : "A";
      if (defenderRole === "A" && this.playerA.action === null) {
        this.playerA.action = "timeout";
      } else if (defenderRole === "B" && this.playerB.action === null) {
        this.playerB.action = "timeout";
      }
      this.processTurn();
    }, TURN_TIME_LIMIT * 1000);
  }

  private processTurn(): void {
    if (this.turnProcessing) return;
    this.turnProcessing = true;

    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }

    if (!this.playerA.card || !this.playerB.card) return;

    const attackerRole = this.currentTurnType === "A_attacks" ? "A" : "B";
    const attackerSlot = attackerRole === "A" ? this.playerA : this.playerB;
    const defenderSlot = attackerRole === "A" ? this.playerB : this.playerA;

    const result = resolveTurnBased(
      this.currentTurn,
      this.currentTurnType,
      {
        hp: attackerSlot.hp,
        attack: attackerSlot.card!.attack,
        defense: attackerSlot.card!.defense,
        specialCd: attackerSlot.specialCd,
      },
      {
        hp: defenderSlot.hp,
        attack: defenderSlot.card!.attack,
        defense: defenderSlot.card!.defense,
        specialCd: defenderSlot.specialCd,
      },
      attackerSlot.action!,
      defenderSlot.action!
    );

    // HP更新
    this.playerA.hp = result.playerA.hpAfter;
    this.playerB.hp = result.playerB.hpAfter;
    this.playerA.specialCd = result.playerA.specialCd;
    this.playerB.specialCd = result.playerB.specialCd;

    // ホストに結果を通知
    this.events?.onTurnResult(result);

    // ゲストに結果を送信
    this.sendToGuest({ type: "turn_result", result });

    // 勝敗判定
    const aAlive = this.playerA.hp > 0;
    const bAlive = this.playerB.hp > 0;

    if (!aAlive || !bAlive) {
      let winner: "A" | "B";
      if (!aAlive && !bAlive) {
        winner = "A";
      } else {
        winner = aAlive ? "A" : "B";
      }

      // EXP計算
      const statsA = this.playerA.card!;
      const statsB = this.playerB.card!;
      const expA = calcExpGain(winner === "A", statsA, statsB);
      const expB = calcExpGain(winner === "B", statsB, statsA);

      const newExpA = this.playerA.exp + expA;
      const newExpB = this.playerB.exp + expB;
      const newLevelA = calcLevel(newExpA);
      const newLevelB = calcLevel(newExpB);

      const endData: BattleEndData = {
        winner,
        finalState: {
          roomCode: "p2p",
          status: "finished",
          playerA: { card: this.playerA.card!, hp: this.playerA.hp },
          playerB: { card: this.playerB.card!, hp: this.playerB.hp },
          currentTurn: this.currentTurn,
          turnType: this.currentTurnType,
        },
        expGained: { A: expA, B: expB },
        levelUp: {
          A: newLevelA > this.playerA.level,
          B: newLevelB > this.playerB.level,
        },
        cardStats: {
          A: {
            level: newLevelA,
            exp: newExpA,
            totalWins: this.playerA.wins + (winner === "A" ? 1 : 0),
            totalLosses: this.playerA.losses + (winner === "A" ? 0 : 1),
          },
          B: {
            level: newLevelB,
            exp: newExpB,
            totalWins: this.playerB.wins + (winner === "B" ? 1 : 0),
            totalLosses: this.playerB.losses + (winner === "B" ? 0 : 1),
          },
        },
      };

      // ホストに通知
      this.events?.onBattleEnd(endData);

      // ゲストに送信
      this.sendToGuest({ type: "battle_end", data: endData });

      // ローカルデータ更新（ホスト側のカード）
      // NOTE: 呼び出し側でcardUidを使ってsaveLocalCardする
    } else {
      // 次のターンへ
      setTimeout(() => this.startTurn(), 2000);
    }
  }

  private sendToGuest(msg: HostToGuestMessage): void {
    if (this.guestConnected) {
      MC.sendData(JSON.stringify(msg));
    }
  }
}
