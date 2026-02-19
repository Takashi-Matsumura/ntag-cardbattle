import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, FlatList, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import type { Card } from "@nfc-card-battle/shared";
import { getCharacterImageUrl, getExpProgress, getEffectiveStats } from "@nfc-card-battle/shared";
import { initNfc, readNfcUid } from "@/lib/nfc";
import { saveCardToken } from "@/lib/card-tokens";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000";

// ngrok無料版のブラウザ警告をスキップ
const fetchHeaders = { "ngrok-skip-browser-warning": "true" };

export default function MyCardScreen() {
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    initNfc().then(setNfcSupported);
  }, []);

  // タブ表示時に毎回再取得
  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, [])
  );

  // 登録済みカード一覧取得
  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/cards`, {
        headers: fetchHeaders,
      });
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
        headers: { "Content-Type": "application/json", ...fetchHeaders },
        body: JSON.stringify({ id: uid }),
      });

      if (res.ok) {
        const data = await res.json();
        // トークンを端末に安全に保存
        if (data.token) {
          await saveCardToken(uid, data.token);
        }
        if (data.isExisting) {
          Alert.alert("登録済み", "このカードは既に登録されています");
        } else {
          Alert.alert("成功", `カード ${uid} を登録しました`);
        }
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

  const renderCard = ({ item }: { item: Card }) => {
    const imageUrl = item.character
      ? getCharacterImageUrl(SERVER_URL, item.character.id, "idle")
      : null;
    const expProgress = getExpProgress(item.exp, item.level);
    const effectiveStats = item.character
      ? getEffectiveStats(item.character.hp, item.character.attack, item.character.defense, item.level)
      : null;

    return (
      <View className="bg-[#1a1a2e] rounded-2xl p-4 mb-3 border border-[#2a2a4e] flex-row">
        {/* 左側: カード情報 */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-[#6c5ce7]/20 items-center justify-center mr-3">
              <Ionicons
                name={item.character ? "shield-checkmark" : "help-circle-outline"}
                size={20}
                color={item.character ? "#6c5ce7" : "#555"}
              />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center">
                {item.character ? (
                  <Text className="text-white text-base font-bold">
                    {item.character.name}
                  </Text>
                ) : (
                  <Text className="text-amber-400 text-sm font-medium">
                    キャラクター未割当
                  </Text>
                )}
                {item.character && (
                  <View className="bg-[#6c5ce7]/20 px-2 py-0.5 rounded-md ml-2">
                    <Text className="text-[#6c5ce7] text-xs font-bold">
                      Lv.{item.level}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-gray-600 text-xs font-mono mt-0.5">
                {item.id}
              </Text>
            </View>
          </View>
          {item.character && (
            <>
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
                    style={{ width: `${Math.min(expProgress * 100, 100)}%` }}
                  />
                </View>
              </View>
              {/* ステータス（レベル補正後） */}
              <View className="flex-row mt-2.5 gap-3 ml-13">
                <View className="bg-red-500/10 px-3 py-1.5 rounded-lg">
                  <Text className="text-red-400 text-xs font-bold">
                    HP {effectiveStats?.hp}
                  </Text>
                </View>
                <View className="bg-orange-500/10 px-3 py-1.5 rounded-lg">
                  <Text className="text-orange-400 text-xs font-bold">
                    攻撃 {effectiveStats?.attack}
                  </Text>
                </View>
                <View className="bg-blue-500/10 px-3 py-1.5 rounded-lg">
                  <Text className="text-blue-400 text-xs font-bold">
                    防御 {effectiveStats?.defense}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 右側: キャラクター画像 */}
        {item.character && (
          <View className="w-20 h-20 rounded-xl bg-[#6c5ce7]/10 items-center justify-center ml-3 overflow-hidden">
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                className="w-full h-full"
                resizeMode="contain"
                defaultSource={undefined}
                onError={() => {}}
              />
            ) : (
              <Ionicons name="person-outline" size={32} color="#6c5ce7" />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 px-6 pt-4">
      {/* NFC状態 */}
      {nfcSupported === false && (
        <View className="bg-amber-500/10 rounded-2xl p-3 mb-4 flex-row items-center border border-amber-500/20">
          <Ionicons name="warning-outline" size={18} color="#f59e0b" />
          <Text className="text-amber-400 ml-2 text-sm">
            この端末はNFCに対応していません
          </Text>
        </View>
      )}

      {/* スキャンボタン */}
      <TouchableOpacity
        onPress={scanAndRegister}
        disabled={scanning || nfcSupported === false}
        className={`py-4 rounded-2xl mb-6 flex-row items-center justify-center ${
          scanning ? "bg-[#1a1a2e]" : "bg-[#6c5ce7]"
        }`}
      >
        <Ionicons
          name={scanning ? "radio-outline" : "scan-outline"}
          size={22}
          color="#fff"
        />
        <Text className="text-white font-bold text-base ml-2">
          {scanning ? "スキャン中..." : "カードを登録"}
        </Text>
      </TouchableOpacity>

      {/* カード一覧ヘッダ */}
      <View className="flex-row items-center mb-3">
        <Ionicons name="layers-outline" size={16} color="#555" />
        <Text className="text-gray-500 ml-1.5 text-sm">
          登録済みカード ({cards.length})
        </Text>
      </View>

      {/* カード一覧 */}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Ionicons name="card-outline" size={48} color="#2a2a4e" />
            <Text className="text-gray-600 text-sm mt-3">
              カードが登録されていません
            </Text>
          </View>
        }
      />
    </View>
  );
}
