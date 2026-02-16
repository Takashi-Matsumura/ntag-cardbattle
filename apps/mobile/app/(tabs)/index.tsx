import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
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
      <View className="flex-1">
        <CameraView
          className="flex-1"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        <TouchableOpacity
          onPress={() => setScanning(false)}
          className="absolute bottom-12 self-center bg-red-500 px-8 py-3 rounded-full"
        >
          <Text className="text-white font-bold text-lg">キャンセル</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-white text-3xl font-bold mb-2">
        NFC Card Battle
      </Text>
      <Text className="text-gray-400 mb-12">
        カードをかざしてバトル開始！
      </Text>

      {/* ルーム作成ボタン */}
      <TouchableOpacity
        onPress={createRoom}
        className="bg-red-500 w-full py-4 rounded-xl mb-4"
      >
        <Text className="text-white text-center font-bold text-lg">
          ルーム作成
        </Text>
      </TouchableOpacity>

      {/* QRコード表示 */}
      {roomCode && (
        <View className="bg-white rounded-xl p-6 items-center mb-4 w-full">
          <Text className="text-gray-800 font-bold mb-2">
            ルームコード: {roomCode}
          </Text>
          <QRCodeDisplay value={`nfc-battle://join/${roomCode}`} />
          <Text className="text-gray-500 text-sm mt-2">
            相手にQRコードを見せてください
          </Text>
        </View>
      )}

      {/* QRスキャンボタン */}
      <TouchableOpacity
        onPress={startScan}
        className="bg-blue-500 w-full py-4 rounded-xl"
      >
        <Text className="text-white text-center font-bold text-lg">
          QRスキャンで参加
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// QRコード表示コンポーネント
function QRCodeDisplay({ value }: { value: string }) {
  try {
    const QRCode = require("react-native-qrcode-svg").default;
    return <QRCode value={value} size={200} />;
  } catch {
    return (
      <View className="w-48 h-48 bg-gray-200 items-center justify-center rounded">
        <Text className="text-gray-500 text-sm text-center">
          QRコード{"\n"}{value}
        </Text>
      </View>
    );
  }
}
