import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  FlatList,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cards, setCards] = useState<LocalCardData[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadCards();
      initNfc().then(setNfcSupported);
    }, [])
  );

  const loadCards = async () => {
    const all = await getAllLocalCards();
    setCards(all);
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
