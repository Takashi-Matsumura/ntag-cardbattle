import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, FlatList } from "react-native";
import type { Character, Card } from "@nfc-card-battle/shared";
import { initNfc, readNfcUid } from "@/lib/nfc";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000";

export default function MyCardScreen() {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    initNfc().then(setNfcSupported);
    fetchCards();
  }, []);

  // 登録済みカード一覧取得
  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/cards`);
      const data = await res.json();
      setCards(data);
    } catch {
      // オフライン時は無視
    }
  }, []);

  // NFCスキャン → カード登録
  const scanAndRegister = async () => {
    setScanning(true);
    try {
      const uid = await readNfcUid();
      if (!uid) {
        Alert.alert("エラー", "カードを読み取れませんでした");
        return;
      }

      const res = await fetch(`${SERVER_URL}/api/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: uid }),
      });

      if (res.status === 409) {
        Alert.alert("登録済み", "このカードは既に登録されています");
      } else if (res.ok) {
        Alert.alert("成功", `カード ${uid} を登録しました`);
        fetchCards();
      } else {
        Alert.alert("エラー", "カード登録に失敗しました");
      }
    } catch {
      Alert.alert("エラー", "サーバに接続できません");
    } finally {
      setScanning(false);
    }
  };

  const renderCard = ({ item }: { item: Card }) => (
    <View className="bg-white/10 rounded-xl p-4 mb-3">
      <Text className="text-gray-400 text-xs font-mono">{item.id}</Text>
      {item.character ? (
        <View className="mt-2">
          <Text className="text-white text-lg font-bold">
            {item.character.name}
          </Text>
          <View className="flex-row mt-1 gap-4">
            <Text className="text-red-400">HP {item.character.hp}</Text>
            <Text className="text-orange-400">攻撃 {item.character.attack}</Text>
            <Text className="text-blue-400">防御 {item.character.defense}</Text>
          </View>
        </View>
      ) : (
        <Text className="text-yellow-400 mt-1">キャラクター未割当</Text>
      )}
    </View>
  );

  return (
    <View className="flex-1 p-6">
      <Text className="text-white text-2xl font-bold mb-6">マイカード</Text>

      {/* NFC状態 */}
      {nfcSupported === false && (
        <View className="bg-yellow-500/20 rounded-xl p-3 mb-4">
          <Text className="text-yellow-400">
            この端末はNFCに対応していません
          </Text>
        </View>
      )}

      {/* スキャンボタン */}
      <TouchableOpacity
        onPress={scanAndRegister}
        disabled={scanning || nfcSupported === false}
        className={`py-4 rounded-xl mb-6 ${
          scanning ? "bg-gray-600" : "bg-green-600"
        }`}
      >
        <Text className="text-white text-center font-bold text-lg">
          {scanning ? "スキャン中..." : "カードを登録"}
        </Text>
      </TouchableOpacity>

      {/* カード一覧 */}
      <Text className="text-gray-400 mb-3">
        登録済みカード ({cards.length})
      </Text>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListEmptyComponent={
          <Text className="text-gray-500 text-center py-8">
            カードが登録されていません
          </Text>
        }
      />
    </View>
  );
}
