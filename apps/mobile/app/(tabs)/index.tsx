import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center px-6">
      {/* タイトル */}
      <View className="items-center mb-16">
        <Ionicons name="flash" size={48} color="#6c5ce7" />
        <Text className="text-white text-3xl font-bold mt-3 tracking-wider">
          NFC BATTLE
        </Text>
        <Text className="text-gray-500 text-sm mt-1">
          カードをかざしてバトル開始
        </Text>
      </View>

      {/* ローカル対戦ボタン */}
      <TouchableOpacity
        onPress={() => router.push("/battle/local")}
        className="bg-[#6c5ce7] w-full py-4 rounded-2xl mb-3 flex-row items-center justify-center"
      >
        <Ionicons name="bluetooth" size={22} color="#fff" />
        <Text className="text-white font-bold text-base ml-2">
          ローカル対戦
        </Text>
      </TouchableOpacity>

      {/* 区切り */}
      <View className="flex-row items-center w-full my-6">
        <View className="flex-1 h-px bg-[#2a2a4e]" />
        <Text className="text-gray-600 text-xs mx-4">or</Text>
        <View className="flex-1 h-px bg-[#2a2a4e]" />
      </View>

      {/* チュートリアル */}
      <TouchableOpacity
        onPress={() => router.push("/battle/tutorial")}
        className="bg-[#1a1a2e] w-full py-4 rounded-2xl border border-[#2a2a4e] flex-row items-center justify-center"
      >
        <Ionicons name="school-outline" size={22} color="#888" />
        <Text className="text-gray-400 font-bold text-base ml-2">
          チュートリアル
        </Text>
      </TouchableOpacity>
    </View>
  );
}
