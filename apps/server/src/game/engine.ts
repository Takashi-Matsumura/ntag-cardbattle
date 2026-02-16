import {
  MIN_DAMAGE,
  DEFENSE_MULTIPLIER,
  type ActionType,
  type TurnResult,
} from "@nfc-card-battle/shared";

interface Player {
  hp: number;
  attack: number;
  defense: number;
}

// ダメージ計算
function calculateDamage(
  attacker: Player,
  defender: Player,
  attackerAction: ActionType,
  defenderAction: ActionType
): number {
  // 防御側はダメージを与えない
  if (attackerAction === "defend") return 0;

  // 攻撃 vs 防御: 防御力2倍
  if (defenderAction === "defend") {
    return Math.max(
      attacker.attack - defender.defense * DEFENSE_MULTIPLIER,
      0
    );
  }

  // 攻撃 vs 攻撃: 通常ダメージ
  return Math.max(attacker.attack - defender.defense, MIN_DAMAGE);
}

// ターン処理
export function resolveTurn(
  turn: number,
  playerA: Player,
  playerB: Player,
  actionA: ActionType,
  actionB: ActionType
): TurnResult {
  const damageToB = calculateDamage(playerA, playerB, actionA, actionB);
  const damageToA = calculateDamage(playerB, playerA, actionB, actionA);

  const hpAfterA = Math.max(playerA.hp - damageToA, 0);
  const hpAfterB = Math.max(playerB.hp - damageToB, 0);

  return {
    turn,
    playerA: {
      action: actionA,
      damageTaken: damageToA,
      hpAfter: hpAfterA,
    },
    playerB: {
      action: actionB,
      damageTaken: damageToB,
      hpAfter: hpAfterB,
    },
  };
}
