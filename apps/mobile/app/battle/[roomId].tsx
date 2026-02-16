import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type {
  Character,
  TurnResult,
  BattleState,
  ActionType,
} from "@nfc-card-battle/shared";
import { TURN_TIME_LIMIT } from "@nfc-card-battle/shared";
import { socket } from "@/lib/socket";
import { readNfcUid } from "@/lib/nfc";

type Phase = "scan" | "waiting" | "battle" | "finished";

export default function BattleScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("scan");
  const [myCard, setMyCard] = useState<Character | null>(null);
  const [opponentCard, setOpponentCard] = useState<Character | null>(null);
  const [myHp, setMyHp] = useState(0);
  const [opponentHp, setOpponentHp] = useState(0);
  const [turn, setTurn] = useState(0);
  const [timer, setTimer] = useState(TURN_TIME_LIMIT);
  const [lastResult, setLastResult] = useState<TurnResult | null>(null);
  const [winner, setWinner] = useState<"A" | "B" | null>(null);
  const [actionSelected, setActionSelected] = useState(false);
  const [myRole, setMyRole] = useState<"A" | "B" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // カード登録成功
    const onCardRegistered = ({ card }: { card: Character }) => {
      setMyCard(card);
      setMyHp(card.hp);
      setPhase("waiting");
    };

    // 相手カード登録
    const onOpponentCard = ({ card }: { card: Character }) => {
      setOpponentCard(card);
      setOpponentHp(card.hp);
    };

    // バトル開始
    const onBattleStart = ({
      turn: t,
      timeLimit,
    }: {
      turn: number;
      timeLimit: number;
    }) => {
      setPhase("battle");
      setTurn(t);
      setTimer(timeLimit);
      setActionSelected(false);
      setLastResult(null);

      // タイマー開始
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    // ターン結果
    const onTurnResult = (result: TurnResult) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setLastResult(result);

      // 自分のロールに基づいてHP更新
      if (myRole === "A") {
        setMyHp(result.playerA.hpAfter);
        setOpponentHp(result.playerB.hpAfter);
      } else {
        setMyHp(result.playerB.hpAfter);
        setOpponentHp(result.playerA.hpAfter);
      }
    };

    // バトル終了
    const onBattleEnd = ({
      winner: w,
    }: {
      winner: "A" | "B";
      finalState: BattleState;
    }) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setWinner(w);
      setPhase("finished");
    };

    // 相手切断
    const onDisconnected = () => {
      Alert.alert("通知", "相手が切断しました", [
        { text: "OK", onPress: () => router.back() },
      ]);
    };

    // エラー
    const onError = ({ message }: { message: string }) => {
      Alert.alert("エラー", message);
    };

    socket.on("card_registered", onCardRegistered);
    socket.on("opponent_card_registered", onOpponentCard);
    socket.on("battle_start", onBattleStart);
    socket.on("turn_result", onTurnResult);
    socket.on("battle_end", onBattleEnd);
    socket.on("opponent_disconnected", onDisconnected);
    socket.on("error", onError);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      socket.off("card_registered", onCardRegistered);
      socket.off("opponent_card_registered", onOpponentCard);
      socket.off("battle_start", onBattleStart);
      socket.off("turn_result", onTurnResult);
      socket.off("battle_end", onBattleEnd);
      socket.off("opponent_disconnected", onDisconnected);
      socket.off("error", onError);
    };
  }, [myRole]);

  // ロール推定（ルーム作成者=A、参加者=B）
  useEffect(() => {
    // opponent_joined を受信した側がA、join_room した側がB
    const onOpponentJoined = () => setMyRole("A");
    socket.on("opponent_joined", onOpponentJoined);

    // join_room した場合はB
    if (!myRole) setMyRole("B");

    return () => {
      socket.off("opponent_joined", onOpponentJoined);
    };
  }, []);

  // NFCスキャン
  const scanCard = async () => {
    const uid = await readNfcUid();
    if (!uid) {
      Alert.alert("エラー", "カードを読み取れませんでした");
      return;
    }
    socket.emit("register_card", { cardUid: uid });
  };

  // アクション選択
  const selectAction = (action: ActionType) => {
    if (actionSelected) return;
    setActionSelected(true);
    socket.emit("select_action", { action });
  };

  // HPバー
  const HpBar = ({
    current,
    max,
    color,
  }: {
    current: number;
    max: number;
    color: string;
  }) => {
    const pct = Math.max(0, (current / max) * 100);
    return (
      <View className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </View>
    );
  };

  // --- カードスキャンフェーズ ---
  if (phase === "scan") {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-white text-2xl font-bold mb-4">
          カードをスキャン
        </Text>
        <Text className="text-gray-400 mb-8">
          NTAGカードをスマホにかざしてください
        </Text>
        <TouchableOpacity
          onPress={scanCard}
          className="bg-green-600 px-8 py-4 rounded-xl"
        >
          <Text className="text-white font-bold text-lg">スキャン開始</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- 待機フェーズ ---
  if (phase === "waiting") {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-white text-2xl font-bold mb-2">
          {myCard?.name}
        </Text>
        <Text className="text-gray-400 mb-8">
          {opponentCard
            ? "バトル開始を待っています..."
            : "相手のカードスキャンを待っています..."}
        </Text>
        {opponentCard && (
          <Text className="text-red-400 text-lg">
            VS {opponentCard.name}
          </Text>
        )}
      </View>
    );
  }

  // --- バトル終了 ---
  if (phase === "finished") {
    const isWinner = winner === myRole;
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text
          className={`text-5xl font-bold mb-4 ${
            isWinner ? "text-yellow-400" : "text-gray-400"
          }`}
        >
          {isWinner ? "勝利！" : "敗北..."}
        </Text>
        <Text className="text-gray-400 mb-8">
          {myCard?.name} vs {opponentCard?.name}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-blue-500 px-8 py-3 rounded-xl"
        >
          <Text className="text-white font-bold text-lg">ホームに戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- バトルフェーズ ---
  return (
    <View className="flex-1 p-4">
      {/* ターン情報 */}
      <View className="items-center mb-4">
        <Text className="text-gray-400">ターン {turn}</Text>
        <Text
          className={`text-2xl font-bold ${
            timer <= 5 ? "text-red-500" : "text-white"
          }`}
        >
          {timer}秒
        </Text>
      </View>

      {/* 相手キャラクター */}
      <View className="bg-white/5 rounded-xl p-4 mb-4">
        <Text className="text-red-400 text-lg font-bold">
          {opponentCard?.name}
        </Text>
        <HpBar
          current={opponentHp}
          max={opponentCard?.hp ?? 1}
          color="bg-red-500"
        />
        <Text className="text-gray-400 text-sm mt-1">
          HP: {opponentHp} / {opponentCard?.hp}
        </Text>
      </View>

      {/* ターン結果 */}
      {lastResult && (
        <View className="bg-yellow-500/10 rounded-xl p-3 mb-4 items-center">
          <Text className="text-yellow-400 font-bold">
            {myRole === "A"
              ? `${lastResult.playerA.damageTaken}ダメージ受けた / ${lastResult.playerB.damageTaken}ダメージ与えた`
              : `${lastResult.playerB.damageTaken}ダメージ受けた / ${lastResult.playerA.damageTaken}ダメージ与えた`}
          </Text>
        </View>
      )}

      {/* 自分キャラクター */}
      <View className="bg-white/5 rounded-xl p-4 mb-6">
        <Text className="text-blue-400 text-lg font-bold">
          {myCard?.name}
        </Text>
        <HpBar
          current={myHp}
          max={myCard?.hp ?? 1}
          color="bg-blue-500"
        />
        <Text className="text-gray-400 text-sm mt-1">
          HP: {myHp} / {myCard?.hp}
        </Text>
      </View>

      {/* アクション選択 */}
      <View className="flex-row gap-4">
        <TouchableOpacity
          onPress={() => selectAction("attack")}
          disabled={actionSelected}
          className={`flex-1 py-4 rounded-xl ${
            actionSelected ? "bg-gray-600" : "bg-red-600"
          }`}
        >
          <Text className="text-white text-center font-bold text-xl">
            ⚔️ 攻撃
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => selectAction("defend")}
          disabled={actionSelected}
          className={`flex-1 py-4 rounded-xl ${
            actionSelected ? "bg-gray-600" : "bg-blue-600"
          }`}
        >
          <Text className="text-white text-center font-bold text-xl">
            🛡️ 防御
          </Text>
        </TouchableOpacity>
      </View>

      {actionSelected && (
        <Text className="text-gray-400 text-center mt-3">
          相手の行動を待っています...
        </Text>
      )}
    </View>
  );
}
