export const TURN_TIME_LIMIT = 15; // 秒
export const MIN_DAMAGE = 1; // 最低ダメージ
export const DEFENSE_MULTIPLIER = 1.5; // 防御時の防御力倍率
export const DAMAGE_VARIANCE = 0.15; // ±15%のダメージ変動幅
export const SPECIAL_COOLDOWN = 3; // 必殺技クールダウン（ターン数）
export const SPECIAL_MULTIPLIER = 1.8; // 必殺技の攻撃力倍率
export const COUNTER_SUCCESS_RATE = 0.3; // カウンター成功率（30%）
export const COUNTER_DAMAGE_MULTIPLIER = 1.5; // カウンター成功時のダメージ倍率

// --- 経験値・レベル ---
export const MAX_LEVEL = 20;
export const EXP_BASE_WIN = 30; // 勝利時のベースEXP
export const EXP_BASE_LOSE = 10; // 敗北時のベースEXP
export const EXP_MIN = 5; // 最低獲得EXP
export const EXP_MAX = 50; // 最大獲得EXP
export const LEVEL_STAT_BONUS = 0.02; // レベルごとのステータス補正（+2%/Lv）
