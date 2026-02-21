import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CharacterBase } from "@nfc-card-battle/shared";
import { CHARACTERS } from "@nfc-card-battle/shared";

const STORAGE_KEY = "local_cards";

export interface LocalCardData {
  cardUid: string;
  characterId: number; // CHARACTERSのインデックス（1始まり）
  level: number;
  exp: number;
  totalWins: number;
  totalLosses: number;
}

// 全ローカルカードデータを取得
export async function getAllLocalCards(): Promise<LocalCardData[]> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (!json) return [];
  return JSON.parse(json);
}

// UID指定でカードデータを取得
export async function getLocalCard(cardUid: string): Promise<LocalCardData | null> {
  const cards = await getAllLocalCards();
  return cards.find((c) => c.cardUid === cardUid) ?? null;
}

// カードデータを保存（新規 or 更新）
export async function saveLocalCard(card: LocalCardData): Promise<void> {
  const cards = await getAllLocalCards();
  const index = cards.findIndex((c) => c.cardUid === card.cardUid);
  if (index >= 0) {
    cards[index] = card;
  } else {
    cards.push(card);
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

// サーバから取得したカード情報をローカルにキャッシュ
export async function cacheCardFromServer(
  cardUid: string,
  characterId: number,
  level: number,
  exp: number,
  totalWins: number,
  totalLosses: number,
): Promise<void> {
  await saveLocalCard({ cardUid, characterId, level, exp, totalWins, totalLosses });
}

// characterIdからベースデータを取得（1始まり）
export function getCharacterBase(characterId: number): CharacterBase | null {
  if (characterId < 1 || characterId > CHARACTERS.length) return null;
  return CHARACTERS[characterId - 1];
}

// 未登録カードにランダムキャラクターを割り当てて自動登録
export async function autoRegisterCard(cardUid: string): Promise<LocalCardData> {
  const characterId = Math.floor(Math.random() * CHARACTERS.length) + 1;
  const card: LocalCardData = {
    cardUid,
    characterId,
    level: 1,
    exp: 0,
    totalWins: 0,
    totalLosses: 0,
  };
  await saveLocalCard(card);
  return card;
}

// カードデータを削除
export async function removeLocalCard(cardUid: string): Promise<void> {
  const cards = await getAllLocalCards();
  const filtered = cards.filter((c) => c.cardUid !== cardUid);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
