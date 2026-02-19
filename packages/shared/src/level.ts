import { MAX_LEVEL, LEVEL_STAT_BONUS, EXP_BASE_WIN, EXP_BASE_LOSE, EXP_MIN, EXP_MAX } from "./constants";

// Lv N到達に必要な累積EXP = N² × 10
export function getRequiredExp(level: number): number {
  return level * level * 10;
}

// 累積EXPからレベル算出
export function calcLevel(totalExp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && totalExp >= getRequiredExp(level + 1)) {
    level++;
  }
  return level;
}

// ステータス倍率: 1 + (level-1) × LEVEL_STAT_BONUS
export function getLevelMultiplier(level: number): number {
  return 1 + (level - 1) * LEVEL_STAT_BONUS;
}

// 補正後ステータス
export function getEffectiveStats(
  hp: number,
  atk: number,
  def: number,
  level: number
): { hp: number; attack: number; defense: number } {
  const mult = getLevelMultiplier(level);
  return {
    hp: Math.round(hp * mult),
    attack: Math.round(atk * mult),
    defense: Math.round(def * mult),
  };
}

// EXP獲得量を算出（相手との戦力差で変動）
// myStats/opponentStats はレベル補正済みの実戦ステータス
export function calcExpGain(
  isWin: boolean,
  myStats: { hp: number; attack: number; defense: number },
  opponentStats: { hp: number; attack: number; defense: number }
): number {
  const myPower = myStats.hp + myStats.attack + myStats.defense;
  const opPower = opponentStats.hp + opponentStats.attack + opponentStats.defense;
  const ratio = myPower > 0 ? opPower / myPower : 1;
  const baseExp = isWin ? EXP_BASE_WIN : EXP_BASE_LOSE;
  return Math.min(EXP_MAX, Math.max(EXP_MIN, Math.round(baseExp * ratio)));
}

// 次レベルまでの進捗率 (0.0~1.0)
export function getExpProgress(totalExp: number, level: number): number {
  if (level >= MAX_LEVEL) return 1;
  const currentLevelExp = getRequiredExp(level);
  const nextLevelExp = getRequiredExp(level + 1);
  return Math.max(0, (totalExp - currentLevelExp) / (nextLevelExp - currentLevelExp));
}
