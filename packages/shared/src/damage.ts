import { DAMAGE_VARIANCE, MIN_DAMAGE } from "./constants";

// ダメージにランダム変動を加える（±DAMAGE_VARIANCE）
export function varyDamage(baseDamage: number): number {
  if (baseDamage === 0) return 0;
  const variance = 1 + (Math.random() * 2 - 1) * DAMAGE_VARIANCE;
  return Math.max(Math.round(baseDamage * variance), MIN_DAMAGE);
}
