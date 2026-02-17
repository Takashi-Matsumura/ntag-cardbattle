import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Character } from "@nfc-card-battle/shared";
import {
  MIN_DAMAGE,
  DEFENSE_MULTIPLIER,
  TURN_TIME_LIMIT,
} from "@nfc-card-battle/shared";
import { readNfcUid } from "@/lib/nfc";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000";
const fetchHeaders = { "ngrok-skip-browser-warning": "true" };

// バトル定数
const SPECIAL_COOLDOWN = 3;
const SPECIAL_MULTIPLIER = 1.8;
const COUNTER_SUCCESS_RATE = 0.3;
const COUNTER_DAMAGE_MULTIPLIER = 1.5;

type Phase = "scan" | "intro" | "battle" | "finished";
type TurnType = "player_attack" | "cpu_attack";

const getTip = (turnType: TurnType, turn: number): string => {
  if (turnType === "player_attack") {
    if (turn <= 1) return "「攻撃」か「必殺技」を選びましょう";
    if (turn <= 3) return "必殺技は威力が高いがクールダウンあり";
    return "相手のHPを見て攻撃方法を選ぼう";
  } else {
    if (turn <= 2) return "「防御」か「カウンター」を選びましょう";
    if (turn <= 4) return "カウンターは成功率30%で大ダメージ";
    return "防御すればダメージを大きく減らせる";
  }
};

export default function TutorialScreen() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("scan");
  const [scanning, setScanning] = useState(false);
  const [playerChar, setPlayerChar] = useState<Character | null>(null);
  const [cpuChar, setCpuChar] = useState<Character | null>(null);
  const [myHp, setMyHp] = useState(0);
  const [cpuHp, setCpuHp] = useState(0);
  const [turn, setTurn] = useState(0);
  const [turnType, setTurnType] = useState<TurnType>("player_attack");
  const [timer, setTimer] = useState(TURN_TIME_LIMIT);
  const [actionSelected, setActionSelected] = useState(false);
  const [playerSpecialCd, setPlayerSpecialCd] = useState(0);
  const [cpuSpecialCd, setCpuSpecialCd] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState<"player" | "cpu" | null>(null);

  // 構造化された結果データ
  const [resultData, setResultData] = useState<{
    header: string;
    damage: number;
    label: string;
    description: string;
    type: "deal" | "take" | "counter_ok" | "counter_fail" | "defend" | "perfect";
  } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const damageAnim = useRef(new Animated.Value(0)).current;
  const numberAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fieldAnim = useRef(new Animated.Value(0)).current;

  // --- NFCスキャン ---
  const scanCard = async () => {
    setScanning(true);
    try {
      const uid = await readNfcUid();
      if (!uid) {
        Alert.alert("エラー", "カードを読み取れませんでした");
        setScanning(false);
        return;
      }

      const cardRes = await fetch(`${SERVER_URL}/api/cards`, {
        headers: fetchHeaders,
      });
      const cards = await cardRes.json();
      const myCard = cards.find((c: { id: string }) => c.id === uid);

      if (!myCard || !myCard.character) {
        Alert.alert(
          "エラー",
          "このカードは未登録またはキャラクターが割り当てられていません"
        );
        setScanning(false);
        return;
      }

      setPlayerChar(myCard.character);
      setMyHp(myCard.character.hp);

      const charsRes = await fetch(`${SERVER_URL}/api/characters`, {
        headers: fetchHeaders,
      });
      const characters: Character[] = await charsRes.json();
      const candidates = characters.filter(
        (c) => c.id !== myCard.character.id
      );
      const cpuPick =
        candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : characters[Math.floor(Math.random() * characters.length)];

      setCpuChar(cpuPick);
      setCpuHp(cpuPick.hp);
      setPhase("intro");
    } catch {
      Alert.alert("エラー", "サーバに接続できません");
    } finally {
      setScanning(false);
    }
  };

  // --- ターン開始 ---
  const startTurn = useCallback((type: TurnType) => {
    setTurn((t) => t + 1);
    setTurnType(type);
    setTimer(TURN_TIME_LIMIT);
    setActionSelected(false);
    setShowResult(false);
    setResultData(null);

    if (type === "player_attack") {
      setPlayerSpecialCd((cd) => Math.max(cd - 1, 0));
    } else {
      setCpuSpecialCd((cd) => Math.max(cd - 1, 0));
    }

    // フィールドアニメーション
    fieldAnim.setValue(0);
    Animated.timing(fieldAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

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
  }, []);

  // --- タイムアウト ---
  useEffect(() => {
    if (timer === 0 && phase === "battle" && !actionSelected) {
      if (turnType === "player_attack") {
        handlePlayerAttack("attack");
      } else {
        handlePlayerDefend("defend");
      }
    }
  }, [timer, phase, actionSelected, turnType]);

  // --- 自分の攻撃ターン ---
  const handlePlayerAttack = (action: "attack" | "special") => {
    if (actionSelected || !playerChar || !cpuChar) return;
    setActionSelected(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const isSpecial = action === "special";
    const atkPower = isSpecial
      ? Math.floor(playerChar.attack * SPECIAL_MULTIPLIER)
      : playerChar.attack;
    const dmg = Math.max(atkPower - cpuChar.defense, MIN_DAMAGE);

    if (isSpecial) {
      setPlayerSpecialCd(SPECIAL_COOLDOWN);
    }

    const result = {
      header: isSpecial
        ? `${playerChar.name}の必殺技！`
        : `${playerChar.name}の攻撃！`,
      damage: dmg,
      label: "DAMAGE",
      description: `${cpuChar.name}に${dmg}ダメージ！`,
      type: isSpecial ? ("deal" as const) : ("deal" as const),
    };

    // 処理中アニメーション
    damageAnim.setValue(0);
    Animated.timing(damageAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      setResultData(result);
      setShowResult(true);

      // 数値バウンスアニメーション
      numberAnim.setValue(0);
      Animated.sequence([
        Animated.timing(numberAnim, {
          toValue: 1.4,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(numberAnim, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();

      const newCpuHp = Math.max(cpuHp - dmg, 0);
      setCpuHp(newCpuHp);

      if (newCpuHp <= 0) {
        setTimeout(() => {
          setWinner("player");
          setPhase("finished");
        }, 1500);
      } else {
        setTimeout(() => startTurn("cpu_attack"), 2000);
      }
    }, 600);
  };

  // --- 相手の攻撃ターン ---
  const handlePlayerDefend = (action: "defend" | "counter") => {
    if (actionSelected || !playerChar || !cpuChar) return;
    setActionSelected(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const cpuCanSpecial = cpuSpecialCd <= 0;
    const cpuUsesSpecial = cpuCanSpecial && Math.random() < 0.3;
    const cpuAtkPower = cpuUsesSpecial
      ? Math.floor(cpuChar.attack * SPECIAL_MULTIPLIER)
      : cpuChar.attack;

    if (cpuUsesSpecial) {
      setCpuSpecialCd(SPECIAL_COOLDOWN);
    }

    let dmgToPlayer = 0;
    let dmgToCpu = 0;
    const cpuHeader = cpuUsesSpecial
      ? `${cpuChar.name}の必殺技！`
      : `${cpuChar.name}の攻撃！`;

    let result: typeof resultData;

    if (action === "counter") {
      const success = Math.random() < COUNTER_SUCCESS_RATE;
      if (success) {
        dmgToCpu = Math.floor(playerChar.attack * COUNTER_DAMAGE_MULTIPLIER);
        result = {
          header: cpuHeader,
          damage: dmgToCpu,
          label: "COUNTER",
          description: "カウンター成功！反撃ダメージ！",
          type: "counter_ok",
        };
      } else {
        dmgToPlayer = Math.max(cpuAtkPower - playerChar.defense, MIN_DAMAGE);
        result = {
          header: cpuHeader,
          damage: dmgToPlayer,
          label: "DAMAGE",
          description: "カウンター失敗...",
          type: "counter_fail",
        };
      }
    } else {
      dmgToPlayer = Math.max(
        cpuAtkPower - playerChar.defense * DEFENSE_MULTIPLIER,
        0
      );
      if (dmgToPlayer > 0) {
        result = {
          header: cpuHeader,
          damage: dmgToPlayer,
          label: "BLOCKED",
          description: "防御成功！ダメージ軽減！",
          type: "defend",
        };
      } else {
        result = {
          header: cpuHeader,
          damage: 0,
          label: "PERFECT",
          description: "完全防御！ダメージを防いだ！",
          type: "perfect",
        };
      }
    }

    damageAnim.setValue(0);
    Animated.timing(damageAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      setResultData(result);
      setShowResult(true);

      // 数値バウンスアニメーション
      numberAnim.setValue(0);
      Animated.sequence([
        Animated.timing(numberAnim, {
          toValue: 1.4,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(numberAnim, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();

      // ダメージを受けた時のシェイクアニメーション
      if (dmgToPlayer > 0) {
        shakeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
      }

      const newMyHp = Math.max(myHp - dmgToPlayer, 0);
      const newCpuHp = Math.max(cpuHp - dmgToCpu, 0);
      setMyHp(newMyHp);
      setCpuHp(newCpuHp);

      if (newMyHp <= 0 || newCpuHp <= 0) {
        setTimeout(() => {
          setWinner(newCpuHp <= 0 ? "player" : "cpu");
          setPhase("finished");
        }, 1500);
      } else {
        setTimeout(() => startTurn("player_attack"), 2000);
      }
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- HPバー ---
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
      <View className="w-full h-2.5 bg-[#0a0a15] rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </View>
    );
  };

  // ========== Scan Phase ==========
  if (phase === "scan") {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-[#1a1a2e] rounded-3xl p-8 items-center w-full border border-[#2a2a4e]">
          <Ionicons name="school-outline" size={56} color="#6c5ce7" />
          <Text className="text-white text-2xl font-bold mt-4">
            チュートリアル
          </Text>
          <Text className="text-gray-400 text-center mt-3 leading-5">
            まずはカードをスキャンして{"\n"}
            キャラクターをセットしましょう
          </Text>
          <TouchableOpacity
            onPress={scanCard}
            disabled={scanning}
            className={`w-full py-4 rounded-2xl mt-6 flex-row items-center justify-center ${
              scanning ? "bg-[#0f0f1a]" : "bg-[#6c5ce7]"
            }`}
          >
            <Ionicons
              name={scanning ? "radio-outline" : "scan-outline"}
              size={22}
              color="#fff"
            />
            <Text className="text-white font-bold text-base ml-2">
              {scanning ? "読み取り中..." : "カードをスキャン"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ========== Intro Phase ==========
  if (phase === "intro" && playerChar && cpuChar) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-[#1a1a2e] rounded-3xl p-8 items-center w-full border border-[#2a2a4e]">
          <Text className="text-gray-400 text-sm mb-4">対戦カード</Text>
          <View className="bg-[#0f0f1a] rounded-2xl p-5 w-full">
            <View className="flex-row items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-[#6c5ce7]/20 items-center justify-center mr-3">
                <Ionicons name="person" size={24} color="#6c5ce7" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-lg">
                  {playerChar.name}
                </Text>
                <View className="flex-row gap-3 mt-1">
                  <Text className="text-red-400 text-xs">HP {playerChar.hp}</Text>
                  <Text className="text-orange-400 text-xs">ATK {playerChar.attack}</Text>
                  <Text className="text-blue-400 text-xs">DEF {playerChar.defense}</Text>
                </View>
              </View>
              <Text className="text-gray-600 text-xs">あなた</Text>
            </View>
            <View className="items-center my-2">
              <Text className="text-gray-600 font-bold text-sm">VS</Text>
            </View>
            <View className="flex-row items-center mt-4">
              <View className="w-12 h-12 rounded-full bg-red-500/20 items-center justify-center mr-3">
                <Ionicons name="desktop-outline" size={24} color="#e94560" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-lg">{cpuChar.name}</Text>
                <View className="flex-row gap-3 mt-1">
                  <Text className="text-red-400 text-xs">HP {cpuChar.hp}</Text>
                  <Text className="text-orange-400 text-xs">ATK {cpuChar.attack}</Text>
                  <Text className="text-blue-400 text-xs">DEF {cpuChar.defense}</Text>
                </View>
              </View>
              <Text className="text-gray-600 text-xs">CPU</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              setPhase("battle");
              startTurn("player_attack");
            }}
            className="bg-[#6c5ce7] w-full py-4 rounded-2xl mt-6 flex-row items-center justify-center"
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Text className="text-white font-bold text-base ml-2">
              バトル開始
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ========== Finished Phase ==========
  if (phase === "finished" && playerChar && cpuChar) {
    const isWin = winner === "player";
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-[#1a1a2e] rounded-3xl p-8 items-center w-full border border-[#2a2a4e]">
          <Ionicons
            name={isWin ? "trophy" : "refresh-circle-outline"}
            size={64}
            color={isWin ? "#f1c40f" : "#888"}
          />
          <Text
            className={`text-3xl font-bold mt-4 ${
              isWin ? "text-yellow-400" : "text-gray-400"
            }`}
          >
            {isWin ? "勝利！" : "敗北..."}
          </Text>
          <Text className="text-gray-500 mt-2">
            {playerChar.name} vs {cpuChar.name} ({turn}ターン)
          </Text>
          <View className="w-full mt-6 gap-3">
            <TouchableOpacity
              onPress={() => {
                setTurn(0);
                setWinner(null);
                setPlayerChar(null);
                setCpuChar(null);
                setPlayerSpecialCd(0);
                setCpuSpecialCd(0);
                setPhase("scan");
              }}
              className="bg-[#6c5ce7] w-full py-4 rounded-2xl flex-row items-center justify-center"
            >
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text className="text-white font-bold text-base ml-2">
                もう一度
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-[#0f0f1a] w-full py-4 rounded-2xl border border-[#2a2a4e] flex-row items-center justify-center"
            >
              <Ionicons name="home-outline" size={20} color="#888" />
              <Text className="text-gray-400 font-bold text-base ml-2">
                ホームに戻る
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ========== Battle Phase ==========
  if (!playerChar || !cpuChar) return null;

  const isPlayerTurn = turnType === "player_attack";
  const tip = getTip(turnType, turn);

  return (
    <View className="flex-1">
      {/* ===== 上部: CPU ステータス ===== */}
      <View className="px-4 pt-2">
        <View className="bg-[#1a1a2e] rounded-xl px-4 py-3 border border-[#2a2a4e]">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-red-500/15 items-center justify-center mr-2">
                <Ionicons name="desktop-outline" size={14} color="#e94560" />
              </View>
              <Text className="text-red-400 font-bold text-sm">
                {cpuChar.name}
              </Text>
            </View>
            <Text className="text-gray-500 text-xs">
              {cpuHp} / {cpuChar.hp}
            </Text>
          </View>
          <HpBar current={cpuHp} max={cpuChar.hp} color="bg-red-500" />
        </View>
      </View>

      {/* ===== 中央: バトルフィールド ===== */}
      <View className="flex-1 px-6">
        {/* ターン情報バー */}
        <View className="flex-row items-center justify-between mt-4 mb-2">
          <View className="flex-row items-center">
            <Text className="text-gray-600 text-xs">TURN {turn}</Text>
            <View
              className={`ml-2 px-2.5 py-1 rounded-full ${
                isPlayerTurn ? "bg-[#6c5ce7]/15" : "bg-red-500/15"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  isPlayerTurn ? "text-[#6c5ce7]" : "text-red-400"
                }`}
              >
                {isPlayerTurn ? "YOUR ATTACK" : "ENEMY ATTACK"}
              </Text>
            </View>
          </View>
          <View
            className={`flex-row items-center px-3 py-1 rounded-full ${
              timer <= 5 ? "bg-red-500/15" : "bg-[#1a1a2e]"
            }`}
          >
            <Ionicons
              name="time-outline"
              size={14}
              color={timer <= 5 ? "#e94560" : "#555"}
            />
            <Text
              className={`text-base font-bold ml-1 ${
                timer <= 5 ? "text-red-500" : "text-gray-400"
              }`}
            >
              {timer}
            </Text>
          </View>
        </View>

        {/* 区切り線 */}
        <View className="h-px bg-[#1a1a2e] mb-4" />

        {/* フィールド中央エリア */}
        <View className="flex-1 justify-center items-center">
          {showResult && resultData ? (
            // === 結果表示 ===
            <Animated.View
              className="items-center w-full"
              style={{
                opacity: damageAnim,
                transform: [{ translateX: shakeAnim }],
              }}
            >
              {/* ヘッダー（誰の攻撃か） */}
              <Text className="text-gray-400 text-lg font-bold mb-2">
                {resultData.header}
              </Text>

              {/* ダメージ数値（メイン） */}
              {resultData.damage > 0 ? (
                <View className="items-center my-4">
                  <Animated.View
                    style={{ transform: [{ scale: numberAnim }] }}
                    className="items-center"
                  >
                    <Text
                      className={`font-black ${
                        resultData.type === "counter_ok"
                          ? "text-emerald-400"
                          : resultData.type === "counter_fail" ||
                              resultData.type === "deal"
                            ? "text-amber-400"
                            : "text-blue-400"
                      }`}
                      style={{ fontSize: 72, lineHeight: 80 }}
                    >
                      {resultData.damage}
                    </Text>
                  </Animated.View>
                  <Text
                    className={`text-sm font-bold tracking-widest mt-1 ${
                      resultData.type === "counter_ok"
                        ? "text-emerald-500/60"
                        : resultData.type === "counter_fail" ||
                            resultData.type === "deal"
                          ? "text-amber-500/60"
                          : "text-blue-500/60"
                    }`}
                  >
                    {resultData.label}
                  </Text>
                </View>
              ) : (
                <View className="items-center my-4">
                  <Animated.View
                    style={{ transform: [{ scale: numberAnim }] }}
                  >
                    <View className="w-20 h-20 rounded-full bg-emerald-500/15 items-center justify-center">
                      <Ionicons name="shield-checkmark" size={40} color="#10b981" />
                    </View>
                  </Animated.View>
                  <Text
                    className="text-emerald-400/60 text-sm font-bold tracking-widest mt-3"
                  >
                    {resultData.label}
                  </Text>
                </View>
              )}

              {/* 説明テキスト */}
              <View
                className={`px-5 py-2.5 rounded-full mt-2 ${
                  resultData.type === "counter_ok" || resultData.type === "perfect"
                    ? "bg-emerald-500/10"
                    : resultData.type === "counter_fail"
                      ? "bg-red-500/10"
                      : resultData.type === "defend"
                        ? "bg-blue-500/10"
                        : "bg-amber-500/10"
                }`}
              >
                <Text
                  className={`text-base font-bold ${
                    resultData.type === "counter_ok" || resultData.type === "perfect"
                      ? "text-emerald-400"
                      : resultData.type === "counter_fail"
                        ? "text-red-400"
                        : resultData.type === "defend"
                          ? "text-blue-400"
                          : "text-amber-400"
                  }`}
                >
                  {resultData.description}
                </Text>
              </View>
            </Animated.View>
          ) : actionSelected ? (
            // === アクション処理中 ===
            <View className="items-center">
              <Animated.View
                style={{
                  opacity: damageAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                }}
              >
                <Ionicons
                  name={isPlayerTurn ? "flame" : "shield-half-outline"}
                  size={64}
                  color={isPlayerTurn ? "#6c5ce7" : "#e94560"}
                />
              </Animated.View>
              <Text className="text-gray-400 text-lg font-bold mt-4">
                {isPlayerTurn ? "攻撃中..." : "判定中..."}
              </Text>
            </View>
          ) : (
            // === ターン開始表示 ===
            <Animated.View
              className="items-center"
              style={{ opacity: fieldAnim }}
            >
              <View
                className={`w-28 h-28 rounded-full items-center justify-center mb-6 ${
                  isPlayerTurn ? "bg-[#6c5ce7]/10" : "bg-red-500/10"
                }`}
              >
                <View
                  className={`w-20 h-20 rounded-full items-center justify-center ${
                    isPlayerTurn ? "bg-[#6c5ce7]/20" : "bg-red-500/20"
                  }`}
                >
                  <Ionicons
                    name={isPlayerTurn ? "flame" : "shield-half-outline"}
                    size={40}
                    color={isPlayerTurn ? "#6c5ce7" : "#e94560"}
                  />
                </View>
              </View>
              <Text className="text-white text-2xl font-bold">
                {isPlayerTurn ? "あなたの攻撃" : "相手の攻撃"}
              </Text>
              <Text className="text-gray-500 text-base mt-3">{tip}</Text>
            </Animated.View>
          )}
        </View>
      </View>

      {/* ===== 下部: 自分ステータス + アクション ===== */}
      <View className="px-4 pb-10">
        {/* 自分HP */}
        <View className="bg-[#1a1a2e] rounded-xl px-4 py-3 mb-3 border border-[#2a2a4e]">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-[#6c5ce7]/15 items-center justify-center mr-2">
                <Ionicons name="person" size={14} color="#6c5ce7" />
              </View>
              <Text className="text-[#6c5ce7] font-bold text-sm">
                {playerChar.name}
              </Text>
            </View>
            <Text className="text-gray-500 text-xs">
              {myHp} / {playerChar.hp}
            </Text>
          </View>
          <HpBar current={myHp} max={playerChar.hp} color="bg-[#6c5ce7]" />
        </View>

        {/* アクションボタン */}
        {isPlayerTurn ? (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => handlePlayerAttack("attack")}
              disabled={actionSelected}
              className={`flex-1 py-4 rounded-xl flex-row items-center justify-center ${
                actionSelected
                  ? "bg-[#1a1a2e] border border-[#2a2a4e]"
                  : "bg-red-500/90"
              }`}
            >
              <Ionicons
                name="flame"
                size={22}
                color={actionSelected ? "#555" : "#fff"}
              />
              <Text
                className={`font-bold text-base ml-2 ${
                  actionSelected ? "text-gray-600" : "text-white"
                }`}
              >
                攻撃
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handlePlayerAttack("special")}
              disabled={actionSelected || playerSpecialCd > 0}
              className={`flex-1 py-4 rounded-xl items-center justify-center ${
                actionSelected || playerSpecialCd > 0
                  ? "bg-[#1a1a2e] border border-[#2a2a4e]"
                  : "bg-amber-500/90"
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name="flash"
                  size={22}
                  color={
                    actionSelected || playerSpecialCd > 0 ? "#555" : "#fff"
                  }
                />
                <Text
                  className={`font-bold text-base ml-2 ${
                    actionSelected || playerSpecialCd > 0
                      ? "text-gray-600"
                      : "text-white"
                  }`}
                >
                  必殺技
                </Text>
              </View>
              {playerSpecialCd > 0 && (
                <Text className="text-gray-600 text-xs mt-0.5">
                  CT: {playerSpecialCd}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => handlePlayerDefend("defend")}
              disabled={actionSelected}
              className={`flex-1 py-4 rounded-xl flex-row items-center justify-center ${
                actionSelected
                  ? "bg-[#1a1a2e] border border-[#2a2a4e]"
                  : "bg-blue-500/90"
              }`}
            >
              <Ionicons
                name="shield"
                size={22}
                color={actionSelected ? "#555" : "#fff"}
              />
              <Text
                className={`font-bold text-base ml-2 ${
                  actionSelected ? "text-gray-600" : "text-white"
                }`}
              >
                防御
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handlePlayerDefend("counter")}
              disabled={actionSelected}
              className={`flex-1 py-4 rounded-xl items-center justify-center ${
                actionSelected
                  ? "bg-[#1a1a2e] border border-[#2a2a4e]"
                  : "bg-orange-500/90"
              }`}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name="flash-outline"
                  size={22}
                  color={actionSelected ? "#555" : "#fff"}
                />
                <Text
                  className={`font-bold text-base ml-2 ${
                    actionSelected ? "text-gray-600" : "text-white"
                  }`}
                >
                  カウンター
                </Text>
              </View>
              <Text
                className={`text-xs mt-0.5 ${
                  actionSelected ? "text-gray-700" : "text-orange-200"
                }`}
              >
                成功率 30%
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
