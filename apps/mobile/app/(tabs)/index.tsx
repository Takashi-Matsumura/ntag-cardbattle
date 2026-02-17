import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { socket } from "@/lib/socket";

export default function HomeScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    // ルーム作成完了
    const onRoomCreated = ({ roomCode }: { roomCode: string }) => {
      setRoomCode(roomCode);
    };

    // 対戦相手参加
    const onOpponentJoined = () => {
      if (roomCode) {
        router.push(`/battle/${roomCode}`);
      }
    };

    socket.on("room_created", onRoomCreated);
    socket.on("opponent_joined", onOpponentJoined);

    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("opponent_joined", onOpponentJoined);
    };
  }, [roomCode]);

  // ルーム作成
  const createRoom = () => {
    setRoomCode(null);
    socket.emit("create_room");
  };

  // QRスキャン開始
  const startScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("エラー", "カメラの権限が必要です");
        return;
      }
    }
    setScanning(true);
  };

  // QRコード読み取り
  const onBarcodeScanned = ({ data }: { data: string }) => {
    setScanning(false);

    // nfc-battle://join/{roomCode} 形式をパース
    const match = data.match(/nfc-battle:\/\/join\/(\w+)/);
    if (match) {
      const code = match[1];
      socket.emit("join_room", { roomCode: code });
      router.push(`/battle/${code}`);
    } else {
      Alert.alert("エラー", "無効なQRコードです");
    }
  };

  // QRスキャン中
  if (scanning) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          className="flex-1"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <TouchableOpacity
          onPress={() => setScanning(false)}
          className="absolute bottom-12 self-center bg-white/20 px-8 py-3 rounded-full flex-row items-center"
        >
          <Ionicons name="close" size={20} color="#fff" />
          <Text className="text-white font-semibold text-base ml-2">
            キャンセル
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

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

      {/* ルーム作成ボタン */}
      <TouchableOpacity
        onPress={createRoom}
        className="bg-[#6c5ce7] w-full py-4 rounded-2xl mb-3 flex-row items-center justify-center"
      >
        <Ionicons name="add-circle-outline" size={22} color="#fff" />
        <Text className="text-white font-bold text-base ml-2">
          ルーム作成
        </Text>
      </TouchableOpacity>

      {/* QRコード表示 */}
      {roomCode && (
        <View className="bg-[#1a1a2e] rounded-2xl p-6 items-center mb-3 w-full border border-[#2a2a4e]">
          <Text className="text-gray-400 text-xs mb-1">ルームコード</Text>
          <Text className="text-white font-bold text-2xl tracking-widest mb-4">
            {roomCode}
          </Text>
          <View className="bg-white rounded-xl p-4">
            <QRCodeDisplay value={`nfc-battle://join/${roomCode}`} />
          </View>
          <Text className="text-gray-500 text-xs mt-3">
            相手にQRコードを見せてください
          </Text>
        </View>
      )}

      {/* QRスキャンボタン */}
      <TouchableOpacity
        onPress={startScan}
        className="bg-[#1a1a2e] w-full py-4 rounded-2xl border border-[#2a2a4e] flex-row items-center justify-center"
      >
        <Ionicons name="qr-code-outline" size={22} color="#6c5ce7" />
        <Text className="text-[#6c5ce7] font-bold text-base ml-2">
          QRスキャンで参加
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

// QRコード表示コンポーネント
function QRCodeDisplay({ value }: { value: string }) {
  try {
    const QRCode = require("react-native-qrcode-svg").default;
    return <QRCode value={value} size={180} />;
  } catch {
    return (
      <View className="w-44 h-44 bg-gray-100 items-center justify-center rounded">
        <Text className="text-gray-400 text-xs text-center">{value}</Text>
      </View>
    );
  }
}
