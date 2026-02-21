import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type {
  Character,
  CharacterImageType,
  TurnResult,
  ResultType,
  ActionType,
} from "@nfc-card-battle/shared";
import {
  TURN_TIME_LIMIT,
  resolveTurnBased,
  type Player,
} from "@nfc-card-battle/shared";
import { readNfcUid } from "@/lib/nfc";
import { BattleCard } from "@/components/BattleCard";
import { ActionCardController } from "@/components/ActionCardController";
import { getSettings } from "@/lib/settings";
import { getLocalCard, getCharacterBase } from "@/lib/local-cards";
import { CHARACTERS } from "@nfc-card-battle/shared";
import {
  preloadSounds,
  playSe,
  playBgm,
  stopBgm,
  unloadAll,
  getSeKeyForResult,
} from "@/lib/audio";

const fetchHeaders = { "ngrok-skip-browser-warning": "true" };

type Phase = "scan" | "intro" | "battle" | "finished";
type TutorialTurn = "player_attack" | "cpu_attack";

interface TutorialResultData {
  header: string;
  damage: number;
  label: string;
  description: string;
  type: ResultType;
}

// TurnResultからチュートリアル用の表示データを構築
function buildTutorialResult(
  result: TurnResult,
  isPlayerAttacker: boolean,
  playerName: string,
  cpuName: string
): TutorialResultData {
  const { resultType, damageToDefender, damageToAttacker, attackerAction } = result;
  const isSpecial = attackerAction === "special";

  if (isPlayerAttacker) {
    switch (resultType) {
      case "defend":
        return {
          header: isSpecial ? `${playerName}の必殺技！` : `${playerName}の攻撃！`,
          damage: damageToDefender,
          label: "BLOCKED",
          description: `${cpuName}が防御！ダメージ軽減！`,
          type: "defend",
        };
      case "perfect":
        return {
          header: isSpecial ? `${playerName}の必殺技！` : `${playerName}の攻撃！`,
          damage: 0,
          label: "PERFECT",
          description: `${cpuName}が完全防御！`,
          type: "perfect",
        };
      case "penalty":
        return {
          header: "時間切れ！隙を突かれた！",
          damage: damageToAttacker,
          label: "PENALTY",
          description: `${cpuName}の反撃で${damageToAttacker}ダメージ！`,
          type: "penalty",
        };
      case "no_guard":
        return {
          header: isSpecial ? `${playerName}の必殺技！` : `${playerName}の攻撃！`,
          damage: damageToDefender,
          label: "NO GUARD",
          description: `${cpuName}が時間切れ！${damageToDefender}ダメージ！`,
          type: "no_guard",
        };
      default:
        return {
          header: `${playerName}の攻撃！`,
          damage: damageToDefender,
          label: "DAMAGE",
          description: `${cpuName}に${damageToDefender}ダメージ！`,
          type: "deal",
        };
    }
  } else {
    switch (resultType) {
      case "defend":
        return {
          header: isSpecial ? `${cpuName}の必殺技！` : `${cpuName}の攻撃！`,
          damage: damageToDefender,
          label: "BLOCKED",
          description: "防御成功！ダメージ軽減！",
          type: "defend",
        };
      case "perfect":
        return {
          header: isSpecial ? `${cpuName}の必殺技！` : `${cpuName}の攻撃！`,
          damage: 0,
          label: "PERFECT",
          description: "完全防御！ダメージを防いだ！",
          type: "perfect",
        };
      case "counter_ok":
        return {
          header: isSpecial ? `${cpuName}の必殺技！` : `${cpuName}の攻撃！`,
          damage: damageToAttacker,
          label: "COUNTER",
          description: "カウンター成功！反撃ダメージ！",
          type: "counter_ok",
        };
      case "counter_fail":
        return {
          header: isSpecial ? `${cpuName}の必殺技！` : `${cpuName}の攻撃！`,
          damage: damageToDefender,
          label: "DAMAGE",
          description: "カウンター失敗！無防備にダメージ！",
          type: "counter_fail",
        };
      case "no_guard":
        return {
          header: "時間切れ！" + (isSpecial ? `${cpuName}の必殺技！` : `${cpuName}の攻撃！`),
          damage: damageToDefender,
          label: "NO GUARD",
          description: `防御なし！${damageToDefender}ダメージ！`,
          type: "no_guard",
        };
      default:
        return {
          header: `${cpuName}の攻撃！`,
          damage: damageToDefender,
          label: "DAMAGE",
          description: `${damageToDefender}ダメージ受けた！`,
          type: "deal",
        };
    }
  }
}

// CPUの攻撃アクション選択（30%の確率で必殺技）
function pickCpuAttackAction(cpuSpecialCd: number): ActionType {
  if (cpuSpecialCd <= 0 && Math.random() < 0.3) return "special";
  return "attack";
}

const getTip = (turnType: TutorialTurn, turn: number): string => {
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
  const [turnType, setTurnType] = useState<TutorialTurn>("player_attack");
  const [timer, setTimer] = useState(TURN_TIME_LIMIT);
  const [actionSelected, setActionSelected] = useState(false);
  const [playerSpecialCd, setPlayerSpecialCd] = useState(0);
  const [cpuSpecialCd, setCpuSpecialCd] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [winner, setWinner] = useState<"player" | "cpu" | null>(null);
  const [playerImageType, setPlayerImageType] = useState<CharacterImageType>("idle");
  const [cpuImageType, setCpuImageType] = useState<CharacterImageType>("idle");
  const [resultData, setResultData] = useState<TutorialResultData | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const damageAnim = useRef(new Animated.Value(0)).current;
  const numberAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fieldAnim = useRef(new Animated.Value(0)).current;

  // CharacterBase + id → Character変換
  const toCharacter = (id: number, base: { name: string; hp: number; attack: number; defense: number }): Character => ({
    id,
    name: base.name,
    hp: base.hp,
    attack: base.attack,
    defense: base.defense,
    imageUrl: null,
  });

  // CPU相手をランダム選出（自分以外）
  const pickCpu = (excludeId: number): Character => {
    const candidates = CHARACTERS.map((c, i) => ({ id: i + 1, ...c })).filter((c) => c.id !== excludeId);
    const pick = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : { id: 1, ...CHARACTERS[0] };
    return toCharacter(pick.id, pick);
  };

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

      const settings = await getSettings();

      if (settings.onlineMode && settings.serverUrl) {
        // オンライン: サーバーからカードデータ取得
        const cardRes = await fetch(`${settings.serverUrl}/api/cards`, {
          headers: fetchHeaders,
        });
        const cards = await cardRes.json();
        const myCard = cards.find((c: { id: string }) => c.id === uid);

        if (!myCard || !myCard.character) {
          Alert.alert("エラー", "このカードは未登録またはキャラクターが割り当てられていません");
          setScanning(false);
          return;
        }

        setPlayerChar(myCard.character);
        setMyHp(myCard.character.hp);

        const cpuPick = pickCpu(myCard.character.id);
        setCpuChar(cpuPick);
        setCpuHp(cpuPick.hp);
      } else {
        // オフライン: ローカルカードデータ使用
        const localCard = await getLocalCard(uid);
        if (!localCard) {
          Alert.alert(
            "未登録カード",
            "このカードは登録されていません。\n設定画面の「カード登録（ガチャ）」で先にカードを登録してください。"
          );
          setScanning(false);
          return;
        }

        const base = getCharacterBase(localCard.characterId);
        if (!base) {
          Alert.alert("エラー", "キャラクターデータが見つかりません");
          setScanning(false);
          return;
        }

        const player = toCharacter(localCard.characterId, base);
        setPlayerChar(player);
        setMyHp(base.hp);

        const cpuPick = pickCpu(localCard.characterId);
        setCpuChar(cpuPick);
        setCpuHp(cpuPick.hp);
      }

      setPhase("intro");
    } catch {
      Alert.alert("エラー", "カードの読み取りに失敗しました");
    } finally {
      setScanning(false);
    }
  };

  // --- ターン開始 ---
  const startTurn = useCallback((type: TutorialTurn) => {
    setTurn((t) => t + 1);
    setTurnType(type);
    setTimer(TURN_TIME_LIMIT);
    setActionSelected(false);
    setShowResult(false);
    setResultData(null);
    setPlayerImageType("idle");
    setCpuImageType("idle");
    playSe("turn");

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

  // ターン結果を処理してアニメーション表示（Player=A, CPU=B）
  const applyTurnResult = (
    result: TurnResult,
    isPlayerAttacker: boolean,
    immediatePlayerImg: CharacterImageType,
    immediateCpuImg: CharacterImageType,
  ) => {
    if (!playerChar || !cpuChar) return;

    setPlayerImageType(immediatePlayerImg);
    setCpuImageType(immediateCpuImg);

    // SE: 結果タイプに応じた効果音
    const seKey = getSeKeyForResult(result.resultType, result.attackerAction, isPlayerAttacker);
    playSe(seKey);

    damageAnim.setValue(0);
    Animated.timing(damageAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      const rd = buildTutorialResult(result, isPlayerAttacker, playerChar.name, cpuChar.name);
      setResultData(rd);
      setShowResult(true);

      // 結果に基づいて画像更新
      if (isPlayerAttacker) {
        if (result.resultType === "penalty") {
          setPlayerImageType("damaged");
          setCpuImageType("attack");
        } else if (result.resultType === "perfect") {
          setCpuImageType("defend");
        } else if (result.damageToDefender > 0) {
          setCpuImageType("damaged");
        }
      } else {
        if (result.resultType === "counter_ok") {
          setPlayerImageType("attack");
          setCpuImageType("damaged");
        } else if (result.resultType === "perfect") {
          setPlayerImageType("defend");
        } else if (result.resultType === "counter_fail" || result.resultType === "no_guard") {
          setPlayerImageType("damaged");
        } else if (result.resultType === "defend") {
          setPlayerImageType(result.damageToDefender > 0 ? "damaged" : "defend");
        }
      }

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

      // プレイヤーがダメージを受けた場合のダメージSE+シェイク
      const playerTookDamage = isPlayerAttacker
        ? result.damageToAttacker > 0
        : result.damageToDefender > 0;
      if (playerTookDamage) {
        playSe("damage");
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

      // HP・クールダウン更新
      const newMyHp = result.playerA.hpAfter;
      const newCpuHp = result.playerB.hpAfter;
      setMyHp(newMyHp);
      setCpuHp(newCpuHp);
      setPlayerSpecialCd(result.playerA.specialCd);
      setCpuSpecialCd(result.playerB.specialCd);

      if (newMyHp <= 0 || newCpuHp <= 0) {
        setTimeout(() => {
          const isWin = newCpuHp <= 0;
          setWinner(isWin ? "player" : "cpu");
          setPhase("finished");
          stopBgm().then(() => playSe(isWin ? "victory" : "defeat"));
        }, 1500);
      } else {
        const nextTurn: TutorialTurn = isPlayerAttacker ? "cpu_attack" : "player_attack";
        setTimeout(() => startTurn(nextTurn), 2000);
      }
    }, 600);
  };

  // --- 攻撃タイムアウト ---
  const handleAttackTimeout = () => {
    if (actionSelected || !playerChar || !cpuChar) return;
    setActionSelected(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const result = resolveTurnBased(
      turn, "A_attacks",
      { hp: myHp, attack: playerChar.attack, defense: playerChar.defense, specialCd: playerSpecialCd },
      { hp: cpuHp, attack: cpuChar.attack, defense: cpuChar.defense, specialCd: cpuSpecialCd },
      "timeout", "defend"
    );
    applyTurnResult(result, true, "damaged", "attack");
  };

  // --- 防御タイムアウト ---
  const handleDefendTimeout = () => {
    if (actionSelected || !playerChar || !cpuChar) return;
    setActionSelected(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const cpuAction = pickCpuAttackAction(cpuSpecialCd);
    const result = resolveTurnBased(
      turn, "B_attacks",
      { hp: cpuHp, attack: cpuChar.attack, defense: cpuChar.defense, specialCd: cpuSpecialCd },
      { hp: myHp, attack: playerChar.attack, defense: playerChar.defense, specialCd: playerSpecialCd },
      cpuAction, "timeout"
    );
    applyTurnResult(result, false, "damaged", cpuAction === "special" ? "special" : "attack");
  };

  // --- タイムアウト ---
  useEffect(() => {
    if (timer === 0 && phase === "battle" && !actionSelected) {
      if (turnType === "player_attack") {
        handleAttackTimeout();
      } else {
        handleDefendTimeout();
      }
    }
  }, [timer, phase, actionSelected, turnType]);

  // --- 自分の攻撃ターン ---
  const handlePlayerAttack = (action: "attack" | "special") => {
    if (actionSelected || !playerChar || !cpuChar) return;
    setActionSelected(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const result = resolveTurnBased(
      turn, "A_attacks",
      { hp: myHp, attack: playerChar.attack, defense: playerChar.defense, specialCd: playerSpecialCd },
      { hp: cpuHp, attack: cpuChar.attack, defense: cpuChar.defense, specialCd: cpuSpecialCd },
      action, "defend"
    );
    applyTurnResult(result, true, action === "special" ? "special" : "attack", "idle");
  };

  // --- 相手の攻撃ターン ---
  const handlePlayerDefend = (action: "defend" | "counter") => {
    if (actionSelected || !playerChar || !cpuChar) return;
    setActionSelected(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const cpuAction = pickCpuAttackAction(cpuSpecialCd);
    const result = resolveTurnBased(
      turn, "B_attacks",
      { hp: cpuHp, attack: cpuChar.attack, defense: cpuChar.defense, specialCd: cpuSpecialCd },
      { hp: myHp, attack: playerChar.attack, defense: playerChar.defense, specialCd: playerSpecialCd },
      cpuAction, action
    );
    applyTurnResult(result, false, "idle", cpuAction === "special" ? "special" : "attack");
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopBgm();
      unloadAll();
    };
  }, []);

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
        <Text className="text-gray-400 text-sm mb-4">対戦カード</Text>
        <View className="flex-row items-center w-full gap-3">
          <View className="flex-1">
            <BattleCard
              character={playerChar}
              currentHp={playerChar.hp}
              variant="player"
              imageType="idle"
            />
          </View>
          <Text className="text-gray-600 font-bold text-lg">VS</Text>
          <View className="flex-1">
            <BattleCard
              character={cpuChar}
              currentHp={cpuChar.hp}
              variant="opponent"
              imageType="idle"
            />
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            setPhase("battle");
            preloadSounds().then(() => {
              playBgm();
              playSe("turn");
            });
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
      {/* ===== ターン情報バー ===== */}
      <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
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

      {/* ===== 上部: CPU カード（右寄せ） ===== */}
      <View className="px-4 pt-1 items-end">
        <View className="w-1/2">
          <BattleCard
            character={cpuChar}
            currentHp={cpuHp}
            variant="opponent"
            imageType={cpuImageType}
          />
        </View>
      </View>

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
            {/* ヘッダー（誰の攻撃か） */}
            <Text className="text-gray-400 text-lg font-bold mb-2">
              {resultData.header}
            </Text>

            {/* ダメージ数値（メイン） */}
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
                <Text
                  className="text-emerald-400/60 text-sm font-bold tracking-widest mt-1"
                >
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
              className={`w-20 h-20 rounded-full items-center justify-center mb-3 ${
                isPlayerTurn ? "bg-[#6c5ce7]/10" : "bg-red-500/10"
              }`}
            >
              <View
                className={`w-14 h-14 rounded-full items-center justify-center ${
                  isPlayerTurn ? "bg-[#6c5ce7]/20" : "bg-red-500/20"
                }`}
              >
                <Ionicons
                  name={isPlayerTurn ? "flame" : "shield-half-outline"}
                  size={28}
                  color={isPlayerTurn ? "#6c5ce7" : "#e94560"}
                />
              </View>
            </View>
            <Text className="text-white text-lg font-bold">
              {isPlayerTurn ? "あなたの攻撃" : "相手の攻撃"}
            </Text>
            <Text className="text-gray-500 text-base mt-1">{tip}</Text>
          </Animated.View>
        )}
      </View>

      {/* ===== 下部: アクションカード ===== */}
      <View className="px-4 pb-10 items-center" style={{ overflow: "visible" }}>
        <ActionCardController
          character={playerChar}
          currentHp={myHp}
          imageType={playerImageType}
          isAttackTurn={isPlayerTurn}
          specialCooldown={playerSpecialCd}
          actionSelected={actionSelected}
          onActionConfirm={(action) => {
            if (isPlayerTurn) handlePlayerAttack(action as "attack" | "special");
            else handlePlayerDefend(action as "defend" | "counter");
          }}
        />
      </View>
    </View>
  );
}
