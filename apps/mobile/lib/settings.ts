import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "app_settings";

export interface AppSettings {
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
};

// 設定を読み込み（未保存時はデフォルト値）
export async function getSettings(): Promise<AppSettings> {
  const json = await AsyncStorage.getItem(STORAGE_KEY);
  if (!json) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(json) };
}

// 設定を保存
export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
