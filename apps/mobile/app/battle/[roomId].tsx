import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Alert, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type {
  Character,
  CharacterImageType,
  TurnResult,
  BattleState,
  BattleEndData,
  ActionType,
  TurnType,
  ResultType,
} from "@nfc-card-battle/shared";
import { TURN_TIME_LIMIT, getExpProgress } from "@nfc-card-battle/shared";
import { socket } from "@/lib/socket";
import { readNfcUid, writeNfcData } from "@/lib/nfc";
import { getCardToken } from "@/lib/card-tokens";
import { BattleCard } from "@/components/BattleCard";
import { ActionCardController } from "@/components/ActionCardController";

type Phase = "scan" | "waiting" | "battle" | "finished";

// チュートリアルと同じresultData形式
interface ResultData {
  header: string;
  damage: number;
  label: string;
  description: string;
  type: ResultType | "take";
}

const getTip = (isMyAttack: boolean, turn: number): string => {
  if (isMyAttack) {
    if (turn <= 1) return "「攻撃」か「必殺技」を選びましょう";
    if (turn <= 3) return "必殺技は威力が高いがクールダウンあり";
    return "相手のHPを見て攻撃方法を選ぼう";
  } else {
    if (turn <= 2) return "「防御」か「カウンター」を選びましょう";
    if (turn <= 4) return "カウンターは成功率30%で大ダメージ";
    return "防御すればダメージを大きく減らせる";
  }
};

export default function BattleScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("scan");
  const [scanning, setScanning] = useState(false);
  const [myCard, setMyCard] = useState<Character | null>(null);
  const [myLevel, setMyLevel] = useState(1);
  const [opponentCard, setOpponentCard] = useState<Character | null>(null);
  const [opponentLevel, setOpponentLevel] = useState(1);
  const [myHp, setMyHp] = useState(0);
  const [opponentHp, setOpponentHp] = useState(0);
  const [turn, setTurn] = useState(0);
  const [turnType, setTurnType] = useState<TurnType>("A_attacks");
  const [timer, setTimer] = useState(TURN_TIME_LIMIT);
  const [actionSelected, setActionSelected] = useState(false);
  const [myRole, setMyRole] = useState<"A" | "B" | null>(null);
  const [mySpecialCd, setMySpecialCd] = useState(0);
  const [winner, setWinner] = useState<"A" | "B" | null>(null);
  const [myImageType, setMyImageType] = useState<CharacterImageType>("idle");
  const [opponentImageType, setOpponentImageType] = useState<CharacterImageType>("idle");
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [expGained, setExpGained] = useState(0);
  const [leveledUp, setLeveledUp] = useState(false);
  const [cardStats, setCardStats] = useState<{ level: number; exp: number; totalWins: number; totalLosses: number } | null>(null);
  const [nfcWritePhase, setNfcWritePhase] = useState<"idle" | "writing" | "success" | "failed">("idle");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myRoleRef = useRef<"A" | "B" | null>(null);
  const damageAnim = useRef(new Animated.Value(0)).current;
  const numberAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fieldAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    myRoleRef.current = myRole;
  }, [myRole]);

  useEffect(() => {
    // カード登録成功
    const onCardRegistered = ({ card, role, level }: { card: Character; role: "A" | "B"; level: number }) => {
      setMyCard(card);
      setMyHp(card.hp);
      setMyRole(role);
      setMyLevel(level);
      myRoleRef.current = role;
      setPhase("waiting");
    };

    // 相手カード登録
    const onOpponentCard = ({ card, level }: { card: Character; level: number }) => {
      setOpponentCard(card);
      setOpponentHp(card.hp);
      setOpponentLevel(level);
    };

    // バトル開始（各ターンの開始）
    const onBattleStart = ({
      turn: t,
      timeLimit,
      turnType: tt,
      role,
      specialCd,
    }: {
      turn: number;
      timeLimit: number;
      turnType: TurnType;
      role: "A" | "B";
      specialCd: number;
    }) => {
      setPhase("battle");
      setTurn(t);
      setTurnType(tt);
      setTimer(timeLimit);
      setActionSelected(false);
      setShowResult(false);
      setResultData(null);
      setMyRole(role);
      myRoleRef.current = role;
      setMySpecialCd(specialCd);
      setMyImageType("idle");
      setOpponentImageType("idle");

      // フィールドアニメーション
      fieldAnim.setValue(0);
      Animated.timing(fieldAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();

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

      const role = myRoleRef.current;
      const isAttacker = result.attackerRole === role;
      const myData = role === "A" ? result.playerA : result.playerB;
      const opData = role === "A" ? result.playerB : result.playerA;

      setMyHp(myData.hpAfter);
      setOpponentHp(opData.hpAfter);
      setMySpecialCd(myData.specialCd);

      // resultDataを構築（チュートリアルと同じ形式）
      const rd = buildResultData(result, isAttacker);
      setResultData(rd);

      // 画像タイプ更新
      if (isAttacker) {
        // 自分が攻撃側
        if (result.resultType === "counter_ok") {
          setMyImageType("damaged");
          setOpponentImageType("attack");
        } else if (result.resultType === "penalty") {
          setMyImageType("damaged");
          setOpponentImageType("attack");
        } else {
          setMyImageType(result.attackerAction === "special" ? "special" : "attack");
          if (result.damageToDefender > 0) {
            setOpponentImageType("damaged");
          } else {
            setOpponentImageType("defend");
          }
        }
      } else {
        // 自分が防御側
        if (result.resultType === "counter_ok") {
          setMyImageType("attack");
          setOpponentImageType("damaged");
        } else if (result.resultType === "no_guard") {
          setMyImageType("damaged");
          setOpponentImageType(result.attackerAction === "special" ? "special" : "attack");
        } else if (result.resultType === "counter_fail") {
          setMyImageType("damaged");
          setOpponentImageType(result.attackerAction === "special" ? "special" : "attack");
        } else if (result.resultType === "perfect") {
          setMyImageType("defend");
          setOpponentImageType(result.attackerAction === "special" ? "special" : "attack");
        } else if (result.resultType === "defend") {
          setMyImageType(result.damageToDefender > 0 ? "damaged" : "defend");
          setOpponentImageType(result.attackerAction === "special" ? "special" : "attack");
        } else {
          setMyImageType("idle");
          setOpponentImageType("idle");
        }
      }

      // アニメーション
      damageAnim.setValue(0);
      Animated.timing(damageAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        setShowResult(true);

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

        // ダメージを受けた場合のシェイク
        const tookDamage = isAttacker
          ? result.damageToAttacker > 0
          : result.damageToDefender > 0;
        if (tookDamage) {
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
      }, 600);
    };

    // バトル終了
    const onBattleEnd = (data: BattleEndData) => {
      if (timerRef.current) clearInterval(timerRef.current);
      const role = myRoleRef.current;
      setWinner(data.winner);
      if (role) {
        setExpGained(data.expGained[role]);
        setLeveledUp(data.levelUp[role]);
        setCardStats(data.cardStats[role]);
      }
      setNfcWritePhase("idle");
      setPhase("finished");
    };

    // 相手切断
    const onDisconnected = () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
  }, []);

  // NFCスキャン
  const scanCard = async () => {
    setScanning(true);
    try {
      const uid = await readNfcUid();
      if (!uid) {
        Alert.alert("エラー", "カードを読み取れませんでした");
        setScanning(false);
        return;
      }
      const token = await getCardToken(uid);
      if (!token) {
        Alert.alert("エラー", "カードのトークンが見つかりません。マイカード画面で再登録してください");
        setScanning(false);
        return;
      }
      socket.emit("register_card", { cardUid: uid, token });
    } catch {
      Alert.alert("エラー", "スキャンに失敗しました");
    } finally {
      setScanning(false);
    }
  };

  // アクション選択
  const selectAction = (action: ActionType) => {
    if (actionSelected) return;
    setActionSelected(true);
    socket.emit("select_action", { action });
  };

  // キャンセル（scan/waitingフェーズ）
  const cancelBattle = () => {
    socket.emit("leave_room");
    router.back();
  };

  // TurnResultからresultDataを構築
  const buildResultData = (result: TurnResult, isAttacker: boolean): ResultData => {
    const { resultType, damageToDefender, damageToAttacker } = result;

    if (isAttacker) {
      // 自分が攻撃側
      switch (resultType) {
        case "deal":
          return {
            header: result.attackerAction === "special" ? "必殺技発動！" : "攻撃！",
            damage: damageToDefender,
            label: "DAMAGE",
            description: `${damageToDefender}ダメージを与えた！`,
            type: "deal",
          };
        case "defend":
          return {
            header: result.attackerAction === "special" ? "必殺技発動！" : "攻撃！",
            damage: damageToDefender,
            label: "BLOCKED",
            description: "相手が防御！ダメージ軽減！",
            type: "defend",
          };
        case "perfect":
          return {
            header: result.attackerAction === "special" ? "必殺技発動！" : "攻撃！",
            damage: 0,
            label: "PERFECT",
            description: "相手が完全防御！ダメージ0！",
            type: "perfect",
          };
        case "counter_ok":
          return {
            header: "カウンターされた！",
            damage: damageToAttacker,
            label: "COUNTER",
            description: `反撃で${damageToAttacker}ダメージ受けた！`,
            type: "counter_ok",
          };
        case "counter_fail":
          return {
            header: "カウンター失敗！",
            damage: damageToDefender,
            label: "DAMAGE",
            description: `無防備に${damageToDefender}ダメージ！`,
            type: "counter_fail",
          };
        case "penalty":
          return {
            header: "時間切れ！隙を突かれた！",
            damage: damageToAttacker,
            label: "PENALTY",
            description: `反撃で${damageToAttacker}ダメージ！`,
            type: "penalty",
          };
        case "no_guard":
          return {
            header: result.attackerAction === "special" ? "必殺技発動！" : "攻撃！",
            damage: damageToDefender,
            label: "NO GUARD",
            description: `相手が時間切れ！${damageToDefender}ダメージ！`,
            type: "no_guard",
          };
        default:
          return {
            header: "攻撃！",
            damage: damageToDefender,
            label: "DAMAGE",
            description: `${damageToDefender}ダメージ！`,
            type: "deal",
          };
      }
    } else {
      // 自分が防御側
      switch (resultType) {
        case "deal":
          return {
            header: result.attackerAction === "special" ? "相手の必殺技！" : "相手の攻撃！",
            damage: damageToDefender,
            label: "DAMAGE",
            description: `${damageToDefender}ダメージ受けた！`,
            type: "take",
          };
        case "defend":
          return {
            header: result.attackerAction === "special" ? "相手の必殺技！" : "相手の攻撃！",
            damage: damageToDefender,
            label: "BLOCKED",
            description: "防御成功！ダメージ軽減！",
            type: "defend",
          };
        case "perfect":
          return {
            header: result.attackerAction === "special" ? "相手の必殺技！" : "相手の攻撃！",
            damage: 0,
            label: "PERFECT",
            description: "完全防御！ダメージを防いだ！",
            type: "perfect",
          };
        case "counter_ok":
          return {
            header: result.attackerAction === "special" ? "相手の必殺技！" : "相手の攻撃！",
            damage: damageToAttacker,
            label: "COUNTER",
            description: "カウンター成功！反撃ダメージ！",
            type: "counter_ok",
          };
        case "counter_fail":
          return {
            header: result.attackerAction === "special" ? "相手の必殺技！" : "相手の攻撃！",
            damage: damageToDefender,
            label: "DAMAGE",
            description: "カウンター失敗！無防備にダメージ！",
            type: "counter_fail",
          };
        case "penalty":
          return {
            header: "相手が時間切れ！",
            damage: damageToAttacker,
            label: "PENALTY",
            description: `反撃で${damageToAttacker}ダメージ与えた！`,
            type: "penalty",
          };
        case "no_guard":
          return {
            header: "時間切れ！" + (result.attackerAction === "special" ? "相手の必殺技！" : "相手の攻撃！"),
            damage: damageToDefender,
            label: "NO GUARD",
            description: `防御なし！${damageToDefender}ダメージ！`,
            type: "no_guard",
          };
        default:
          return {
            header: "相手の攻撃！",
            damage: damageToDefender,
            label: "DAMAGE",
            description: `${damageToDefender}ダメージ！`,
            type: "take",
          };
      }
    }
  };

  // ========== Scan Phase ==========
  if (phase === "scan") {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-[#1a1a2e] rounded-3xl p-8 items-center w-full border border-[#2a2a4e]">
          <Ionicons name="shield-half-outline" size={56} color="#6c5ce7" />
          <Text className="text-white text-2xl font-bold mt-4">
            対戦バトル
          </Text>
          <Text className="text-gray-400 text-center mt-3 leading-5">
            カードをスキャンして{"\n"}
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
          <TouchableOpacity
            onPress={cancelBattle}
            className="w-full py-4 rounded-2xl mt-3 flex-row items-center justify-center bg-[#0f0f1a] border border-[#2a2a4e]"
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

  // ========== Waiting Phase ==========
  if (phase === "waiting") {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-gray-400 text-sm mb-4">対戦カード</Text>
        <View className="flex-row items-center w-full gap-3">
          {/* 自分のカード */}
          <View className="flex-1">
            {myCard ? (
              <BattleCard
                character={myCard}
                currentHp={myCard.hp}
                variant="player"
                imageType="idle"
                level={myLevel}
              />
            ) : (
              <View className="bg-[#1a1a2e] rounded-2xl p-6 items-center border border-[#2a2a4e]">
                <Text className="text-gray-500">準備中...</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-600 font-bold text-lg">VS</Text>
          {/* 相手のカード */}
          <View className="flex-1">
            {opponentCard ? (
              <BattleCard
                character={opponentCard}
                currentHp={opponentCard.hp}
                variant="opponent"
                imageType="idle"
                level={opponentLevel}
              />
            ) : (
              <View className="bg-[#1a1a2e] rounded-2xl p-6 items-center border border-[#2a2a4e]">
                <Text className="text-gray-500">待機中...</Text>
              </View>
            )}
          </View>
        </View>
        <Text className="text-gray-500 text-sm mt-4">
          {opponentCard
            ? "バトル開始を待っています..."
            : "相手のカードスキャンを待っています..."}
        </Text>
        <TouchableOpacity
          onPress={cancelBattle}
          className="w-full py-4 rounded-2xl mt-6 flex-row items-center justify-center bg-[#0f0f1a] border border-[#2a2a4e]"
        >
          <Ionicons name="close" size={22} color="#888" />
          <Text className="text-gray-400 font-bold text-base ml-2">
            キャンセル
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // NFC書き込み
  const handleNfcWrite = async () => {
    if (!myCard || !cardStats) return;
    setNfcWritePhase("writing");
    const success = await writeNfcData({
      characterName: myCard.name,
      level: cardStats.level,
      exp: cardStats.exp,
      wins: cardStats.totalWins,
      losses: cardStats.totalLosses,
    });
    setNfcWritePhase(success ? "success" : "failed");
  };

  // ========== Finished Phase ==========
  if (phase === "finished") {
    const isWin = winner === myRole;
    const expProgress = cardStats ? getExpProgress(cardStats.exp, cardStats.level) : 0;
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
            {myCard?.name} vs {opponentCard?.name} ({turn}ターン)
          </Text>

          {/* EXP情報 */}
          {cardStats && (
            <View className="w-full mt-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-400 text-sm font-bold">
                  Lv.{cardStats.level}
                </Text>
                <Text className="text-[#6c5ce7] text-sm font-bold">
                  +{expGained} EXP
                </Text>
              </View>
              {/* EXPバー */}
              <View className="w-full h-3 bg-[#0f0f1a] rounded-full overflow-hidden">
                <View
                  className="h-full bg-[#6c5ce7] rounded-full"
                  style={{ width: `${Math.min(expProgress * 100, 100)}%` }}
                />
              </View>
              {/* レベルアップ表示 */}
              {leveledUp && (
                <View className="flex-row items-center justify-center mt-3 bg-[#6c5ce7]/10 py-2 rounded-xl">
                  <Ionicons name="star" size={18} color="#6c5ce7" />
                  <Text className="text-[#6c5ce7] font-bold text-sm ml-1">
                    レベルアップ！ Lv.{cardStats.level}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* NFC書き込みボタン */}
          {nfcWritePhase === "idle" && (
            <TouchableOpacity
              onPress={handleNfcWrite}
              className="bg-[#6c5ce7]/10 w-full py-4 rounded-2xl mt-5 border border-[#6c5ce7]/30 flex-row items-center justify-center"
            >
              <Ionicons name="phone-portrait-outline" size={20} color="#6c5ce7" />
              <Text className="text-[#6c5ce7] font-bold text-base ml-2">
                カードに記録する
              </Text>
            </TouchableOpacity>
          )}
          {nfcWritePhase === "writing" && (
            <View className="w-full py-4 rounded-2xl mt-5 bg-[#6c5ce7]/10 border border-[#6c5ce7]/30 items-center">
              <Ionicons name="radio-outline" size={20} color="#6c5ce7" />
              <Text className="text-[#6c5ce7] text-sm mt-1">
                カードをかざしてください...
              </Text>
            </View>
          )}
          {nfcWritePhase === "success" && (
            <View className="w-full py-4 rounded-2xl mt-5 bg-emerald-500/10 border border-emerald-500/30 items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Text className="text-emerald-400 text-sm mt-1">記録完了！</Text>
            </View>
          )}
          {nfcWritePhase === "failed" && (
            <TouchableOpacity
              onPress={handleNfcWrite}
              className="w-full py-4 rounded-2xl mt-5 bg-red-500/10 border border-red-500/30 items-center"
            >
              <Ionicons name="alert-circle" size={20} color="#e94560" />
              <Text className="text-red-400 text-sm mt-1">
                失敗しました（タップでリトライ）
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-[#0f0f1a] w-full py-4 rounded-2xl mt-3 border border-[#2a2a4e] flex-row items-center justify-center"
          >
            <Ionicons name="home-outline" size={20} color="#888" />
            <Text className="text-gray-400 font-bold text-base ml-2">
              ホームに戻る
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ========== Battle Phase ==========
  const isMyAttack =
    (turnType === "A_attacks" && myRole === "A") ||
    (turnType === "B_attacks" && myRole === "B");
  const tip = getTip(isMyAttack, turn);

  return (
    <View className="flex-1">
      {/* ===== ターン情報バー ===== */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
        <View className="flex-row items-center">
          <Text className="text-gray-600 text-xs">TURN {turn}</Text>
          <View
            className={`ml-2 px-2.5 py-1 rounded-full ${
              isMyAttack ? "bg-[#6c5ce7]/15" : "bg-red-500/15"
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                isMyAttack ? "text-[#6c5ce7]" : "text-red-400"
              }`}
            >
              {isMyAttack ? "YOUR ATTACK" : "ENEMY ATTACK"}
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

      {/* ===== 上部: 相手カード（右寄せ） ===== */}
      {opponentCard && (
        <View className="px-4 pt-1 items-end">
          <View className="w-1/2">
            <BattleCard
              character={opponentCard}
              currentHp={opponentHp}
              variant="opponent"
              imageType={opponentImageType}
              level={opponentLevel}
            />
          </View>
        </View>
      )}

      {/* ===== 中央: バトルフィールド（オーバーレイ） ===== */}
      <View className="flex-1 px-6 justify-center items-center" style={{ zIndex: 10 }} pointerEvents="none">
        {showResult && resultData ? (
          // === 結果表示 ===
          <Animated.View
            className="items-center w-full"
            style={{
              opacity: damageAnim,
              transform: [{ translateX: shakeAnim }],
            }}
          >
            {/* ヘッダー */}
            <Text className="text-gray-400 text-lg font-bold mb-2">
              {resultData.header}
            </Text>

            {/* ダメージ数値 */}
            {resultData.damage > 0 ? (
              <View className="items-center my-2">
                <Animated.View
                  style={{ transform: [{ scale: numberAnim }] }}
                  className="items-center"
                >
                  <Text
                    className={`font-black ${
                      resultData.type === "counter_ok"
                        ? "text-emerald-400"
                        : resultData.type === "penalty" ||
                            resultData.type === "no_guard"
                          ? "text-red-400"
                          : resultData.type === "counter_fail" ||
                              resultData.type === "deal"
                            ? "text-amber-400"
                            : "text-blue-400"
                    }`}
                    style={{ fontSize: 48, lineHeight: 54 }}
                  >
                    {resultData.damage}
                  </Text>
                </Animated.View>
                <Text
                  className={`text-sm font-bold tracking-widest mt-1 ${
                    resultData.type === "counter_ok"
                      ? "text-emerald-500/60"
                      : resultData.type === "penalty" ||
                          resultData.type === "no_guard"
                        ? "text-red-500/60"
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
              <View className="items-center my-2">
                <Animated.View
                  style={{ transform: [{ scale: numberAnim }] }}
                >
                  <View className="w-14 h-14 rounded-full bg-emerald-500/15 items-center justify-center">
                    <Ionicons name="shield-checkmark" size={28} color="#10b981" />
                  </View>
                </Animated.View>
                <Text className="text-emerald-400/60 text-sm font-bold tracking-widest mt-1">
                  {resultData.label}
                </Text>
              </View>
            )}

            {/* 説明テキスト */}
            <View
              className={`px-5 py-2.5 rounded-full mt-1 ${
                resultData.type === "counter_ok" || resultData.type === "perfect"
                  ? "bg-emerald-500/10"
                  : resultData.type === "counter_fail" ||
                      resultData.type === "penalty" ||
                      resultData.type === "no_guard"
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
                    : resultData.type === "counter_fail" ||
                        resultData.type === "penalty" ||
                        resultData.type === "no_guard"
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
                name={isMyAttack ? "flame" : "shield-half-outline"}
                size={64}
                color={isMyAttack ? "#6c5ce7" : "#e94560"}
              />
            </Animated.View>
            <Text className="text-gray-400 text-lg font-bold mt-4">
              {isMyAttack ? "攻撃中..." : "判定中..."}
            </Text>
          </View>
        ) : (
          // === ターン開始表示 ===
          <Animated.View
            className="items-center"
            style={{ opacity: fieldAnim }}
          >
            <View
              className={`w-20 h-20 rounded-full items-center justify-center mb-3 ${
                isMyAttack ? "bg-[#6c5ce7]/10" : "bg-red-500/10"
              }`}
            >
              <View
                className={`w-14 h-14 rounded-full items-center justify-center ${
                  isMyAttack ? "bg-[#6c5ce7]/20" : "bg-red-500/20"
                }`}
              >
                <Ionicons
                  name={isMyAttack ? "flame" : "shield-half-outline"}
                  size={28}
                  color={isMyAttack ? "#6c5ce7" : "#e94560"}
                />
              </View>
            </View>
            <Text className="text-white text-lg font-bold">
              {isMyAttack ? "あなたの攻撃" : "相手の攻撃"}
            </Text>
            <Text className="text-gray-500 text-base mt-1">{tip}</Text>
          </Animated.View>
        )}
      </View>

      {/* ===== 下部: アクションカード ===== */}
      <View className="px-4 pb-10 items-center" style={{ overflow: "visible" }}>
        {myCard && (
          <ActionCardController
            character={myCard}
            currentHp={myHp}
            imageType={myImageType}
            isAttackTurn={isMyAttack}
            specialCooldown={mySpecialCd}
            actionSelected={actionSelected}
            onActionConfirm={selectAction}
            level={myLevel}
          />
        )}
      </View>
    </View>
  );
}
