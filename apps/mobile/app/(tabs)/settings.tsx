import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { initNfc, readNfcUid } from "@/lib/nfc";
import {
  getAllLocalCards,
  getLocalCard,
  autoRegisterCard,
  removeLocalCard,
  getCharacterBase,
  type LocalCardData,
} from "@/lib/local-cards";
import { getEffectiveStats, getExpProgress } from "@nfc-card-battle/shared";

export default function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    onlineMode: false,
    serverUrl: "",
  });
  const [testing, setTesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cards, setCards] = useState<LocalCardData[]>([]);

  useFocusEffect(
    useCallback(() => {
      getSettings().then(setSettings);
      loadCards();
      initNfc().then(setNfcSupported);
    }, [])
  );

  const loadCards = async () => {
    const all = await getAllLocalCards();
    setCards(all);
  };

  // オンラインモード切替
  const toggleOnlineMode = async (value: boolean) => {
    const updated = { ...settings, onlineMode: value };
    setSettings(updated);
    await saveSettings(updated);
    if (value && updated.serverUrl) {
      connectSocket(updated.serverUrl);
    } else {
      disconnectSocket();
    }
  };

  // サーバーURL変更
  const updateServerUrl = async (url: string) => {
    const updated = { ...settings, serverUrl: url };
    setSettings(updated);
    await saveSettings(updated);
    if (settings.onlineMode && url) {
      connectSocket(url);
    }
  };

  // 接続テスト（中断可能）
  const testConnection = async () => {
    if (!settings.serverUrl) return;
    if (testing) {
      abortRef.current?.abort();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setTesting(true);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(`${settings.serverUrl}/api/cards`, {
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: controller.signal,
      });
      if (res.ok) {
        Alert.alert("成功", "サーバーに接続できました");
      } else {
        Alert.alert("エラー", `サーバーエラー: ${res.status}`);
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === "AbortError") {
        // 中断時はアラートなし
      } else {
        Alert.alert("エラー", "サーバーに接続できません");
      }
    } finally {
      clearTimeout(timeout);
      abortRef.current = null;
      setTesting(false);
    }
  };

  // カード登録（ガチャ）
  const handleGacha = async () => {
    setScanning(true);
    try {
      const uid = await readNfcUid();
      if (!uid) {
        Alert.alert("エラー", "カードを読み取れませんでした");
        return;
      }
      const existing = await getLocalCard(uid);
      if (existing) {
        const existingChara = getCharacterBase(existing.characterId);
        Alert.alert(
          "登録済みカード",
          `このカードには「${existingChara?.name ?? "???"}」(Lv.${existing.level}) が登録されています。\n上書きして再ガチャしますか？`,
          [
            { text: "キャンセル", style: "cancel" },
            {
              text: "上書き登録",
              style: "destructive",
              onPress: async () => {
                await removeLocalCard(uid);
                const newCard = await autoRegisterCard(uid);
                const newChara = getCharacterBase(newCard.characterId);
                Alert.alert("登録完了", `「${newChara?.name ?? "???"}」が割り当てられました！`);
                await loadCards();
              },
            },
          ]
        );
        return;
      }
      const card = await autoRegisterCard(uid);
      const chara = getCharacterBase(card.characterId);
      Alert.alert("登録完了", `「${chara?.name ?? "???"}」が割り当てられました！`);
      await loadCards();
    } catch {
      Alert.alert("エラー", "スキャンに失敗しました");
    } finally {
      setScanning(false);
    }
  };

  // リセット（再ガチャ）
  const handleReset = (card: LocalCardData) => {
    const chara = getCharacterBase(card.characterId);
    Alert.alert(
      "カードリセット",
      `「${chara?.name ?? "???"}」のデータを初期化して再ガチャしますか？\nレベル・戦績がリセットされます。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "リセット",
          style: "destructive",
          onPress: async () => {
            await removeLocalCard(card.cardUid);
            const newCard = await autoRegisterCard(card.cardUid);
            const newChara = getCharacterBase(newCard.characterId);
            Alert.alert("再ガチャ完了", `「${newChara?.name ?? "???"}」が割り当てられました！`);
            await loadCards();
          },
        },
      ]
    );
  };

  const renderCard = ({ item }: { item: LocalCardData }) => {
    const chara = getCharacterBase(item.characterId);
    const stats = chara
      ? getEffectiveStats(chara.hp, chara.attack, chara.defense, item.level)
      : null;
    const progress = getExpProgress(item.exp, item.level);

    return (
      <View className="bg-[#1a1a2e] rounded-2xl p-4 mb-3 border border-[#2a2a4e]">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-[#6c5ce7]/20 items-center justify-center mr-3">
              <Ionicons name="shield-checkmark" size={20} color="#6c5ce7" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                <Text className="text-white text-base font-bold">
                  {chara?.name ?? "???"}
                </Text>
                <View className="bg-[#6c5ce7]/20 px-2 py-0.5 rounded-md ml-2">
                  <Text className="text-[#6c5ce7] text-xs font-bold">
                    Lv.{item.level}
                  </Text>
                </View>
              </View>
              <Text className="text-gray-600 text-xs font-mono mt-0.5">
                {item.cardUid}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => handleReset(item)}
            className="bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20"
          >
            <Text className="text-red-400 text-xs font-bold">リセット</Text>
          </TouchableOpacity>
        </View>

        {/* EXPバー */}
        <View className="mt-2.5 ml-13">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-gray-600 text-[10px]">EXP</Text>
            <Text className="text-gray-600 text-[10px]">
              {item.totalWins}勝 {item.totalLosses}敗
            </Text>
          </View>
          <View className="w-full h-1.5 bg-[#0f0f1a] rounded-full overflow-hidden">
            <View
              className="h-full bg-[#6c5ce7] rounded-full"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </View>
        </View>

        {/* ステータス */}
        {stats && (
          <View className="flex-row mt-2.5 gap-3 ml-13">
            <View className="bg-red-500/10 px-3 py-1.5 rounded-lg">
              <Text className="text-red-400 text-xs font-bold">
                HP {stats.hp}
              </Text>
            </View>
            <View className="bg-orange-500/10 px-3 py-1.5 rounded-lg">
              <Text className="text-orange-400 text-xs font-bold">
                攻撃 {stats.attack}
              </Text>
            </View>
            <View className="bg-blue-500/10 px-3 py-1.5 rounded-lg">
              <Text className="text-blue-400 text-xs font-bold">
                防御 {stats.defense}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={cards}
      keyExtractor={(item) => item.cardUid}
      renderItem={renderCard}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
      ListHeaderComponent={
        <>
          {/* ========== サーバー設定 ========== */}
          <View className="mb-6">
            <View className="flex-row items-center mb-3">
              <Ionicons name="cloud-outline" size={16} color="#555" />
              <Text className="text-gray-500 ml-1.5 text-sm">サーバー設定</Text>
            </View>

            <View className="bg-[#1a1a2e] rounded-2xl p-4 border border-[#2a2a4e]">
              {/* オンラインモード */}
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-white text-base font-bold">
                    オンラインモード
                  </Text>
                  <Text className="text-gray-500 text-xs mt-0.5">
                    サーバーを使った対人戦を有効にする
                  </Text>
                </View>
                <Switch
                  value={settings.onlineMode}
                  onValueChange={toggleOnlineMode}
                  trackColor={{ false: "#2a2a4e", true: "#6c5ce7" }}
                  thumbColor="#fff"
                />
              </View>

              {/* サーバーURL */}
              {settings.onlineMode && (
                <View className="mt-4 pt-4 border-t border-[#2a2a4e]">
                  <Text className="text-gray-400 text-xs mb-2">サーバーURL</Text>
                  <TextInput
                    value={settings.serverUrl}
                    onChangeText={updateServerUrl}
                    placeholder="https://example.ngrok.app"
                    placeholderTextColor="#444"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    className="bg-[#0f0f1a] text-white px-4 py-3 rounded-xl text-sm border border-[#2a2a4e]"
                  />
                  {settings.serverUrl ? (
                    <TouchableOpacity
                      onPress={testConnection}
                      className={`py-3 rounded-xl mt-3 border flex-row items-center justify-center ${
                        testing
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-[#6c5ce7]/10 border-[#6c5ce7]/30"
                      }`}
                    >
                      {testing ? (
                        <>
                          <ActivityIndicator size="small" color="#e94560" />
                          <Text className="text-red-400 font-bold text-sm ml-2">
                            中断
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="wifi-outline" size={18} color="#6c5ce7" />
                          <Text className="text-[#6c5ce7] font-bold text-sm ml-2">
                            接続テスト
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          </View>

          {/* ========== カード管理 ========== */}
          <View className="flex-row items-center mb-3">
            <Ionicons name="layers-outline" size={16} color="#555" />
            <Text className="text-gray-500 ml-1.5 text-sm">カード管理</Text>
          </View>

          {/* NFC警告 */}
          {nfcSupported === false && (
            <View className="bg-amber-500/10 rounded-2xl p-3 mb-3 flex-row items-center border border-amber-500/20">
              <Ionicons name="warning-outline" size={18} color="#f59e0b" />
              <Text className="text-amber-400 ml-2 text-sm">
                この端末はNFCに対応していません
              </Text>
            </View>
          )}

          {/* ガチャボタン */}
          <TouchableOpacity
            onPress={handleGacha}
            disabled={scanning || nfcSupported === false}
            className={`py-4 rounded-2xl mb-4 flex-row items-center justify-center ${
              scanning ? "bg-[#1a1a2e]" : "bg-[#6c5ce7]"
            }`}
          >
            <Ionicons
              name={scanning ? "radio-outline" : "dice-outline"}
              size={22}
              color="#fff"
            />
            <Text className="text-white font-bold text-base ml-2">
              {scanning ? "スキャン中..." : "カード登録（ガチャ）"}
            </Text>
          </TouchableOpacity>

          {/* カードリストヘッダ */}
          <View className="flex-row items-center mb-3">
            <Ionicons name="card-outline" size={14} color="#555" />
            <Text className="text-gray-600 ml-1.5 text-xs">
              登録済みカード ({cards.length})
            </Text>
          </View>
        </>
      }
      ListEmptyComponent={
        <View className="items-center py-12">
          <Ionicons name="card-outline" size={48} color="#2a2a4e" />
          <Text className="text-gray-600 text-sm mt-3">
            カードが登録されていません
          </Text>
          <Text className="text-gray-700 text-xs mt-1">
            上のボタンからNTAGカードをスキャンして登録しましょう
          </Text>
        </View>
      }
      ListFooterComponent={
        <View className="mt-6 mb-8 pt-4 border-t border-[#2a2a4e]">
          <Text className="text-gray-600 text-xs text-center">
            BGM素材: 魔王魂（https://maou.audio/）
          </Text>
        </View>
      }
    />
  );
}
