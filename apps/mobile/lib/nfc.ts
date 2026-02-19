import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";
import type { NfcCardData } from "@nfc-card-battle/shared";

// NFC初期化
export async function initNfc(): Promise<boolean> {
  try {
    const supported = await NfcManager.isSupported();
    if (supported) {
      await NfcManager.start();
    }
    return supported;
  } catch {
    return false;
  }
}

// NTAGカードにデータ書き込み（NDEF TEXT Record）
// 注意: 記念データ用。ゲームロジックはDB正データを使用し、NFCデータは参照しない（改ざん対策）
export async function writeNfcData(data: NfcCardData): Promise<boolean> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    // 省スペース形式で書き込み
    const compact = JSON.stringify({
      n: data.characterName,
      l: data.level,
      x: data.exp,
      w: data.wins,
      s: data.losses,
    });
    const bytes = Ndef.encodeMessage([Ndef.textRecord(compact)]);
    if (bytes) {
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
    }
    return true;
  } catch {
    return false;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}

// NTAGカード読み取り（UIDのみ取得）
export async function readNfcUid(): Promise<string | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.NfcA);
    const tag = await NfcManager.getTag();
    return tag?.id ?? null;
  } catch {
    return null;
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
