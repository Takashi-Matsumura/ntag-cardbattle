import { Audio } from "expo-av";
import type { ResultType, ActionType } from "@nfc-card-battle/shared";

export type SeKey =
  | "attack"
  | "special"
  | "defense"
  | "counterOk"
  | "counterFail"
  | "damage"
  | "victory"
  | "defeat"
  | "turn";

const SE_SOURCES: Record<SeKey, ReturnType<typeof require>> = {
  attack: require("@/assets/sounds/se-attack.mp3"),
  special: require("@/assets/sounds/se-special.mp3"),
  defense: require("@/assets/sounds/se-defense.mp3"),
  counterOk: require("@/assets/sounds/se-counter-ok.mp3"),
  counterFail: require("@/assets/sounds/se-counter-fail.mp3"),
  damage: require("@/assets/sounds/se-damage.mp3"),
  victory: require("@/assets/sounds/se-victory.mp3"),
  defeat: require("@/assets/sounds/se-defeat.mp3"),
  turn: require("@/assets/sounds/se-turn.mp3"),
};

const BGM_SOURCE = require("@/assets/sounds/bgm-battle.mp3");

let seSounds: Partial<Record<SeKey, Audio.Sound>> = {};
let bgmSound: Audio.Sound | null = null;

/** 全SEをメモリにプリロード */
export async function preloadSounds(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const keys = Object.keys(SE_SOURCES) as SeKey[];
    await Promise.all(
      keys.map(async (key) => {
        if (seSounds[key]) return;
        const { sound } = await Audio.Sound.createAsync(SE_SOURCES[key]);
        seSounds[key] = sound;
      })
    );
  } catch {
    // オーディオ初期化失敗は無視（ゲーム続行可能）
  }
}

/** SE再生 */
export async function playSe(key: SeKey): Promise<void> {
  try {
    const sound = seSounds[key];
    if (!sound) return;
    await sound.replayAsync();
  } catch {
    // 再生失敗は無視
  }
}

/** BGMループ再生 */
export async function playBgm(): Promise<void> {
  try {
    if (bgmSound) {
      await bgmSound.replayAsync();
      return;
    }
    const { sound } = await Audio.Sound.createAsync(BGM_SOURCE, {
      isLooping: true,
      volume: 0.4,
    });
    bgmSound = sound;
    await sound.playAsync();
  } catch {
    // BGM再生失敗は無視
  }
}

/** BGM停止 */
export async function stopBgm(): Promise<void> {
  try {
    if (!bgmSound) return;
    await bgmSound.stopAsync();
  } catch {
    // 停止失敗は無視
  }
}

/** 全リソース解放 */
export async function unloadAll(): Promise<void> {
  try {
    const keys = Object.keys(seSounds) as SeKey[];
    await Promise.all(
      keys.map(async (key) => {
        const sound = seSounds[key];
        if (sound) await sound.unloadAsync();
      })
    );
    seSounds = {};

    if (bgmSound) {
      await bgmSound.unloadAsync();
      bgmSound = null;
    }
  } catch {
    // 解放失敗は無視
  }
}

/** ターン結果に応じたSEキーを返す */
export function getSeKeyForResult(
  resultType: ResultType,
  attackerAction: ActionType,
  isAttacker: boolean
): SeKey {
  switch (resultType) {
    case "deal":
      return attackerAction === "special" ? "special" : "attack";
    case "defend":
    case "perfect":
      return "defense";
    case "counter_ok":
      return "counterOk";
    case "counter_fail":
      return "counterFail";
    case "penalty":
    case "no_guard":
      return "damage";
    default:
      return "attack";
  }
}

/** ターン結果でダメージを受けたかどうか */
export function tookDamageFromResult(
  resultType: ResultType,
  damageToAttacker: number,
  damageToDefender: number,
  isAttacker: boolean
): boolean {
  return isAttacker ? damageToAttacker > 0 : damageToDefender > 0;
}
