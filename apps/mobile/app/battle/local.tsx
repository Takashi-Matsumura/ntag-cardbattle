import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as MC from "../../modules/multipeer-connectivity/src";

type Phase = "select" | "searching" | "connected";
type Role = "host" | "guest";

export default function LocalMatchingScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("select");
  const [role, setRole] = useState<Role | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);

  // ネイティブモジュールが利用可能か確認
  const mcAvailable = MC.isAvailable();

  useEffect(() => {
    if (phase !== "searching" || !mcAvailable) return;

    const connSub = MC.addPeerConnectedListener(({ displayName }) => {
      setPeerName(displayName);
      setPhase("connected");
    });

    const discSub = MC.addPeerDisconnectedListener(() => {
      setPeerName(null);
      setPhase("searching");
    });

    return () => {
      connSub.remove();
      discSub.remove();
    };
  }, [phase, mcAvailable]);

  // 接続後にバトル画面へ遷移
  useEffect(() => {
    if (phase !== "connected" || !role) return;
    const timer = setTimeout(() => {
      router.replace(`/battle/p2p?role=${role}`);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, role]);

  const startAsHost = () => {
    if (!mcAvailable) {
      Alert.alert("エラー", "ローカル対戦にはネイティブビルドが必要です。\nnpx expo run:ios で再ビルドしてください。");
      return;
    }
    setRole("host");
    setPhase("searching");
    const name = `プレイヤー${Math.floor(Math.random() * 1000)}`;
    MC.startHost(name);
  };

  const startAsGuest = () => {
    if (!mcAvailable) {
      Alert.alert("エラー", "ローカル対戦にはネイティブビルドが必要です。\nnpx expo run:ios で再ビルドしてください。");
      return;
    }
    setRole("guest");
    setPhase("searching");
    const name = `プレイヤー${Math.floor(Math.random() * 1000)}`;
    MC.startGuest(name);
  };

  const cancel = () => {
    if (mcAvailable) MC.disconnect();
    if (phase === "searching") {
      setPhase("select");
      setRole(null);
    } else {
      router.back();
    }
  };

  // ========== 役割選択 ==========
  if (phase === "select") {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center mb-12">
          <Ionicons name="bluetooth" size={48} color="#6c5ce7" />
          <Text className="text-white text-2xl font-bold mt-3">
            ローカル対戦
          </Text>
          <Text className="text-gray-500 text-sm mt-1 text-center">
            近くのプレイヤーとBluetooth/WiFiで対戦
          </Text>
        </View>

        <TouchableOpacity
          onPress={startAsHost}
          className="bg-[#6c5ce7] w-full py-4 rounded-2xl mb-3 flex-row items-center justify-center"
        >
          <Ionicons name="radio-outline" size={22} color="#fff" />
          <Text className="text-white font-bold text-base ml-2">
            ホストとして始める
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={startAsGuest}
          className="bg-[#1a1a2e] w-full py-4 rounded-2xl mb-3 border border-[#6c5ce7] flex-row items-center justify-center"
        >
          <Ionicons name="search-outline" size={22} color="#6c5ce7" />
          <Text className="text-[#6c5ce7] font-bold text-base ml-2">
            相手を探す
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center w-full my-6">
          <View className="flex-1 h-px bg-[#2a2a4e]" />
        </View>

        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-[#0f0f1a] w-full py-4 rounded-2xl border border-[#2a2a4e] flex-row items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#888" />
          <Text className="text-gray-400 font-bold text-base ml-2">
            戻る
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ========== 検索中 ==========
  if (phase === "searching") {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-[#1a1a2e] rounded-3xl p-8 items-center w-full border border-[#2a2a4e]">
          <ActivityIndicator size="large" color="#6c5ce7" />
          <Text className="text-white text-xl font-bold mt-4">
            {role === "host" ? "相手を待っています..." : "ホストを探しています..."}
          </Text>
          <Text className="text-gray-500 text-sm mt-2 text-center">
            相手の端末も同じ画面を開いてください
          </Text>
          <TouchableOpacity
            onPress={cancel}
            className="bg-[#0f0f1a] w-full py-4 rounded-2xl mt-6 border border-[#2a2a4e] flex-row items-center justify-center"
          >
            <Ionicons name="close" size={22} color="#888" />
            <Text className="text-gray-400 font-bold text-base ml-2">
              キャンセル
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ========== 接続完了 ==========
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="bg-[#1a1a2e] rounded-3xl p-8 items-center w-full border border-[#2a2a4e]">
        <Ionicons name="checkmark-circle" size={56} color="#10b981" />
        <Text className="text-white text-xl font-bold mt-4">
          接続完了！
        </Text>
        {peerName && (
          <Text className="text-gray-400 text-sm mt-2">
            {peerName} と接続しました
          </Text>
        )}
        <Text className="text-gray-500 text-sm mt-2">
          バトル画面に移動中...
        </Text>
      </View>
    </View>
  );
}
