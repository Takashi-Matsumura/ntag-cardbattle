import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { getSocket } from "@/lib/socket";
import { getSettings } from "@/lib/settings";

type MatchingState = "idle" | "qr_display" | "camera_scan";

export default function HomeScreen() {
  const router = useRouter();
  const [matchingState, setMatchingState] = useState<MatchingState>("idle");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const roomCodeRef = useRef<string | null>(null);
  const [onlineMode, setOnlineMode] = useState(false);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  // タブフォーカス時に設定を再読み込み
  useFocusEffect(
    useCallback(() => {
      getSettings().then((s) => {
        setOnlineMode(s.onlineMode);
      });
    }, [])
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // ルーム作成完了
    const onRoomCreated = ({ roomCode: code }: { roomCode: string }) => {
      setRoomCode(code);
      roomCodeRef.current = code;
      setMatchingState("qr_display");
    };

    // 対戦相手参加（ルーム作成者側）
    const onOpponentJoined = () => {
      const code = roomCodeRef.current;
      if (code) {
        router.push(`/battle/${code}`);
      }
    };

    socket.on("room_created", onRoomCreated);
    socket.on("opponent_joined", onOpponentJoined);

    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("opponent_joined", onOpponentJoined);
    };
  }, [onlineMode]);

  // 対戦ボタン → ルーム作成 + QR表示
  const startMatching = () => {
    const socket = getSocket();
    if (!socket) return;
    setRoomCode(null);
    socket.emit("create_room");
  };

  // カメラスキャンモードに切り替え
  const switchToCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("エラー", "カメラの権限が必要です");
        return;
      }
    }
    setMatchingState("camera_scan");
  };

  // QRコード読み取り
  const onBarcodeScanned = ({ data }: { data: string }) => {
    const socket = getSocket();
    if (!socket) return;
    setMatchingState("idle");

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

  // キャンセル → アイドルに戻る
  const cancelMatching = () => {
    if (roomCode) {
      const socket = getSocket();
      if (socket) {
        socket.emit("leave_room");
      }
    }
    setMatchingState("idle");
    setRoomCode(null);
  };

  // カメラスキャン画面
  if (matchingState === "camera_scan") {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />
        {/* スキャンフレームオーバーレイ */}
        <View
          className="absolute inset-0 items-center justify-center"
          pointerEvents="none"
        >
          <View className="w-64 h-64 relative">
            {/* 左上 */}
            <View className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#6c5ce7] rounded-tl-lg" />
            {/* 右上 */}
            <View className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#6c5ce7] rounded-tr-lg" />
            {/* 左下 */}
            <View className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#6c5ce7] rounded-bl-lg" />
            {/* 右下 */}
            <View className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#6c5ce7] rounded-br-lg" />
          </View>
          <Text className="text-white text-base mt-6">
            QRコードをかざしてください
          </Text>
        </View>
        {/* 戻るボタン */}
        <TouchableOpacity
          onPress={() => setMatchingState("qr_display")}
          className="absolute bottom-12 self-center bg-white/20 px-8 py-3 rounded-full flex-row items-center"
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text className="text-white font-semibold text-base ml-2">
            戻る
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

      {matchingState === "idle" ? (
        <>
          {/* オンライン対戦ボタン（オンラインモードON時のみ） */}
          {onlineMode && (
            <TouchableOpacity
              onPress={startMatching}
              className="bg-[#6c5ce7] w-full py-4 rounded-2xl mb-3 flex-row items-center justify-center"
            >
              <Ionicons name="people-outline" size={22} color="#fff" />
              <Text className="text-white font-bold text-base ml-2">
                対戦
              </Text>
            </TouchableOpacity>
          )}

          {/* ローカル対戦ボタン */}
          <TouchableOpacity
            onPress={() => router.push("/battle/local")}
            className="bg-[#1a1a2e] w-full py-4 rounded-2xl mb-3 border border-[#6c5ce7] flex-row items-center justify-center"
          >
            <Ionicons name="bluetooth" size={22} color="#6c5ce7" />
            <Text className="text-[#6c5ce7] font-bold text-base ml-2">
              ローカル対戦
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* QRコード表示 */}
          <View className="bg-[#1a1a2e] rounded-2xl p-6 items-center mb-3 w-full border border-[#2a2a4e]">
            <Text className="text-gray-400 text-xs mb-1">ルームコード</Text>
            <Text className="text-white font-bold text-2xl tracking-widest mb-4">
              {roomCode || "..."}
            </Text>
            {roomCode && (
              <View className="bg-white rounded-xl p-4">
                <QRCodeDisplay value={`nfc-battle://join/${roomCode}`} />
              </View>
            )}
            <Text className="text-gray-500 text-xs mt-3">
              相手にQRコードを見せてください
            </Text>
          </View>

          {/* 相手のQRを読み取るボタン */}
          <TouchableOpacity
            onPress={switchToCamera}
            className="bg-[#6c5ce7] w-full py-4 rounded-2xl mb-3 flex-row items-center justify-center"
          >
            <Ionicons name="camera-outline" size={22} color="#fff" />
            <Text className="text-white font-bold text-base ml-2">
              相手のQRを読み取る
            </Text>
          </TouchableOpacity>

          {/* キャンセルボタン */}
          <TouchableOpacity
            onPress={cancelMatching}
            className="bg-[#1a1a2e] w-full py-4 rounded-2xl border border-[#2a2a4e] flex-row items-center justify-center"
          >
            <Ionicons name="close" size={22} color="#888" />
            <Text className="text-gray-400 font-bold text-base ml-2">
              キャンセル
            </Text>
          </TouchableOpacity>
        </>
      )}

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
