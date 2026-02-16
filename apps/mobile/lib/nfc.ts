import NfcManager, { NfcTech } from "react-native-nfc-manager";

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
