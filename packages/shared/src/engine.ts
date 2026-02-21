import {
  MIN_DAMAGE,
  DEFENSE_MULTIPLIER,
  SPECIAL_MULTIPLIER,
  SPECIAL_COOLDOWN,
  COUNTER_SUCCESS_RATE,
  COUNTER_DAMAGE_MULTIPLIER,
} from "./constants";
import { varyDamage } from "./damage";
import type { ActionType, TurnResult, TurnType, ResultType } from "./types";

export interface Player {
  hp: number;
  attack: number;
  defense: number;
  specialCd: number;
}

// ターン制ダメージ計算
export function resolveTurnBased(
  turn: number,
  turnType: TurnType,
  attacker: Player,
  defender: Player,
  attackerAction: ActionType,
  defenderAction: ActionType
): TurnResult {
  const attackerRole: "A" | "B" = turnType === "A_attacks" ? "A" : "B";
  let damageToDefender = 0;
  let damageToAttacker = 0;
  let resultType: ResultType = "deal";

  // 攻撃側のクールダウン
  let attackerCdAfter = Math.max(attacker.specialCd - 1, 0);
  let defenderCdAfter = Math.max(defender.specialCd - 1, 0);

  // 攻撃側タイムアウト: ペナルティ（防御側が反撃）
  if (attackerAction === "timeout") {
    damageToAttacker = varyDamage(defender.attack);
    resultType = "penalty";
  }
  // 防御側タイムアウト: ノーガード（防御力無視）
  else if (defenderAction === "timeout") {
    const atkPower =
      attackerAction === "special"
        ? Math.floor(attacker.attack * SPECIAL_MULTIPLIER)
        : attacker.attack;
    if (attackerAction === "special") {
      attackerCdAfter = SPECIAL_COOLDOWN;
    }
    damageToDefender = varyDamage(atkPower);
    resultType = "no_guard";
  }
  // 通常の攻撃 vs 防御/カウンター
  else {
    const isSpecial = attackerAction === "special";
    const atkPower = isSpecial
      ? Math.floor(attacker.attack * SPECIAL_MULTIPLIER)
      : attacker.attack;

    if (isSpecial) {
      attackerCdAfter = SPECIAL_COOLDOWN;
    }

    if (defenderAction === "counter") {
      // カウンター判定
      const success = Math.random() < COUNTER_SUCCESS_RATE;
      if (success) {
        // カウンター成功: 攻撃側にダメージ、防御側は無傷
        damageToAttacker = varyDamage(
          Math.floor(defender.attack * COUNTER_DAMAGE_MULTIPLIER)
        );
        resultType = "counter_ok";
      } else {
        // カウンター失敗: 防御力無視のフルダメージ
        damageToDefender = varyDamage(atkPower);
        resultType = "counter_fail";
      }
    } else {
      // 防御（defend）
      const reduced = varyDamage(
        Math.max(atkPower - defender.defense * DEFENSE_MULTIPLIER, 0)
      );
      if (reduced > 0) {
        damageToDefender = reduced;
        resultType = "defend";
      } else {
        damageToDefender = 0;
        resultType = "perfect";
      }
    }
  }

  // HP計算
  const attackerHpAfter = Math.max(attacker.hp - damageToAttacker, 0);
  const defenderHpAfter = Math.max(defender.hp - damageToDefender, 0);

  // A/Bの結果を構築
  const playerA =
    attackerRole === "A"
      ? { hpAfter: attackerHpAfter, specialCd: attackerCdAfter }
      : { hpAfter: defenderHpAfter, specialCd: defenderCdAfter };
  const playerB =
    attackerRole === "B"
      ? { hpAfter: attackerHpAfter, specialCd: attackerCdAfter }
      : { hpAfter: defenderHpAfter, specialCd: defenderCdAfter };

  return {
    turn,
    turnType,
    attackerRole,
    attackerAction,
    defenderAction,
    damageToDefender,
    damageToAttacker,
    resultType,
    playerA,
    playerB,
  };
}
