import * as SecureStore from "expo-secure-store";

const KEY_PREFIX = "card_token_";

// カードUIDに紐づくトークンを保存
export async function saveCardToken(cardUid: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_PREFIX + cardUid, token);
}

// カードUIDに紐づくトークンを取得
export async function getCardToken(cardUid: string): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_PREFIX + cardUid);
}
