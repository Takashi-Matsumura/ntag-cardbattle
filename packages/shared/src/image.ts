import type { CharacterImageType } from "./types";

/** キャラクター画像のパスを返す（サーバルート相対） */
export function getCharacterImagePath(
  characterId: number,
  imageType: CharacterImageType = "idle"
): string {
  return `/characters/${characterId}/${imageType}.png`;
}

/** キャラクター画像のフルURLを返す */
export function getCharacterImageUrl(
  serverUrl: string,
  characterId: number,
  imageType: CharacterImageType = "idle"
): string {
  return `${serverUrl}${getCharacterImagePath(characterId, imageType)}`;
}
