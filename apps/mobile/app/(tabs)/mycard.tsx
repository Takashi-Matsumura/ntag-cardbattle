import { useState, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { getExpProgress, getEffectiveStats } from "@nfc-card-battle/shared";
import { getAllLocalCards, getCharacterBase, type LocalCardData } from "@/lib/local-cards";

export default function MyCardScreen() {
  const [localCards, setLocalCards] = useState<LocalCardData[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLocalCards();
    }, [])
  );

  const loadLocalCards = async () => {
    const all = await getAllLocalCards();
    setLocalCards(all);
  };

  const renderLocalCard = ({ item }: { item: LocalCardData }) => {
    const chara = getCharacterBase(item.characterId);
    const stats = chara
      ? getEffectiveStats(chara.hp, chara.attack, chara.defense, item.level)
      : null;
    const progress = getExpProgress(item.exp, item.level);

    return (
      <View className="bg-[#1a1a2e] rounded-2xl p-4 mb-3 border border-[#2a2a4e]">
        <View className="flex-row items-center">
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
    <View className="flex-1 px-6 pt-4">
      {/* カード一覧ヘッダ */}
      <View className="flex-row items-center mb-3">
        <Ionicons name="layers-outline" size={16} color="#555" />
        <Text className="text-gray-500 ml-1.5 text-sm">
          登録済みカード ({localCards.length})
        </Text>
      </View>

      <FlatList
        data={localCards}
        keyExtractor={(item) => item.cardUid}
        renderItem={renderLocalCard}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="card-outline" size={48} color="#2a2a4e" />
            <Text className="text-gray-600 text-sm mt-3">
              カードが登録されていません
            </Text>
            <Text className="text-gray-700 text-xs mt-1">
              設定タブからカードを登録してください
            </Text>
          </View>
        }
      />
    </View>
  );
}
