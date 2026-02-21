import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Animated } from "react-native";
import type {
  Character,
  CharacterImageType,
  TurnResult,
  TurnType,
  ActionType,
  ResultType,
  BattleEndData,
} from "@nfc-card-battle/shared";
import { TURN_TIME_LIMIT, getExpProgress } from "@nfc-card-battle/shared";
import type { BattleTransport, BattleTransportEvents } from "@/lib/battle-transport";
import {
  preloadSounds,
  playSe,
  playBgm,
  stopBgm,
  unloadAll,
  getSeKeyForResult,
} from "@/lib/audio";

// チュートリアルと共通のresultData形式
export interface ResultData {
  header: string;
  damage: number;
  label: string;
  description: string;
  type: ResultType | "take";
}

export interface BattleAnimations {
  damageAnim: Animated.Value;
  numberAnim: Animated.Value;
  shakeAnim: Animated.Value;
  fieldAnim: Animated.Value;
}

export interface UseBattleReturn {
  // 状態
  phase: "scan" | "waiting" | "battle" | "finished";
  myCard: Character | null;
  myLevel: number;
  opponentCard: Character | null;
  opponentLevel: number;
  myHp: number;
  opponentHp: number;
  turn: number;
  turnType: TurnType;
  timer: number;
  actionSelected: boolean;
  myRole: "A" | "B" | null;
  mySpecialCd: number;
  winner: "A" | "B" | null;
  myImageType: CharacterImageType;
  opponentImageType: CharacterImageType;
  showResult: boolean;
  resultData: ResultData | null;
  expGained: number;
  leveledUp: boolean;
  cardStats: { level: number; exp: number; totalWins: number; totalLosses: number } | null;
  isMyAttack: boolean;
  expProgress: number;
  // アニメーション
  animations: BattleAnimations;
  // アクション
  selectAction: (action: ActionType) => void;
}

// TurnResultからresultDataを構築
function buildResultData(result: TurnResult, isAttacker: boolean): ResultData {
  const { resultType, damageToDefender, damageToAttacker } = result;

  if (isAttacker) {
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
}

export function useBattle(transport: BattleTransport): UseBattleReturn {
  const [phase, setPhase] = useState<"scan" | "waiting" | "battle" | "finished">("scan");
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
  const [battleEndData, setBattleEndData] = useState<BattleEndData | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const myRoleRef = useRef<"A" | "B" | null>(null);
  const audioInitRef = useRef(false);

  const damageAnim = useRef(new Animated.Value(0)).current;
  const numberAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fieldAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    myRoleRef.current = myRole;
  }, [myRole]);

  useEffect(() => {
    const events: BattleTransportEvents = {
      onCardRegistered: ({ card, role, level }) => {
        setMyCard(card);
        setMyHp(card.hp);
        setMyRole(role);
        setMyLevel(level);
        myRoleRef.current = role;
        setPhase("waiting");
      },

      onOpponentCardRegistered: ({ card, level }) => {
        setOpponentCard(card);
        setOpponentHp(card.hp);
        setOpponentLevel(level);
      },

      onBattleStart: ({ turn: t, timeLimit, turnType: tt, role, specialCd }) => {
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

        // オーディオ: 初回はプリロード+BGM開始、以降はターンSE
        if (!audioInitRef.current) {
          audioInitRef.current = true;
          preloadSounds().then(() => {
            playBgm();
            playSe("turn");
          });
        } else {
          playSe("turn");
        }

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
      },

      onTurnResult: (result: TurnResult) => {
        if (timerRef.current) clearInterval(timerRef.current);

        const role = myRoleRef.current;
        const isAttacker = result.attackerRole === role;
        const myData = role === "A" ? result.playerA : result.playerB;
        const opData = role === "A" ? result.playerB : result.playerA;

        setMyHp(myData.hpAfter);
        setOpponentHp(opData.hpAfter);
        setMySpecialCd(myData.specialCd);

        const rd = buildResultData(result, isAttacker);
        setResultData(rd);

        // SE: 結果タイプに応じた効果音
        const seKey = getSeKeyForResult(result.resultType, result.attackerAction, isAttacker);
        playSe(seKey);

        // 600ms後: ダメージ受けた側のSE
        const tookDamage = isAttacker
          ? result.damageToAttacker > 0
          : result.damageToDefender > 0;
        if (tookDamage) {
          setTimeout(() => playSe("damage"), 600);
        }

        // 画像タイプ更新
        if (isAttacker) {
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
      },

      onBattleEnd: (data) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setWinner(data.winner);
        setBattleEndData(data);
        setPhase("finished");

        // BGM停止 → 勝敗SE
        stopBgm().then(() => {
          const isWin = data.winner === myRoleRef.current;
          playSe(isWin ? "victory" : "defeat");
        });
      },

      onOpponentDisconnected: () => {
        if (timerRef.current) clearInterval(timerRef.current);
      },

      onError: () => {},
    };

    transport.connect(events);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      transport.disconnect();
      stopBgm();
      unloadAll();
    };
  }, [transport]);

  const selectAction = useCallback((action: ActionType) => {
    if (actionSelected) return;
    setActionSelected(true);
    transport.selectAction(action);
  }, [actionSelected, transport]);

  const isMyAttack =
    (turnType === "A_attacks" && myRole === "A") ||
    (turnType === "B_attacks" && myRole === "B");

  // BattleEndDataとmyRole（React state）からEXP情報を算出
  const { expGained, leveledUp, cardStats, expProgress } = useMemo(() => {
    if (!battleEndData || !myRole) {
      return { expGained: 0, leveledUp: false, cardStats: null, expProgress: 0 };
    }
    const stats = battleEndData.cardStats[myRole];
    const exp = battleEndData.expGained[myRole];
    const lvUp = battleEndData.levelUp[myRole];
    return {
      expGained: exp,
      leveledUp: lvUp,
      cardStats: stats,
      expProgress: stats ? getExpProgress(stats.exp, stats.level) : 0,
    };
  }, [battleEndData, myRole]);

  return {
    phase,
    myCard,
    myLevel,
    opponentCard,
    opponentLevel,
    myHp,
    opponentHp,
    turn,
    turnType,
    timer,
    actionSelected,
    myRole,
    mySpecialCd,
    winner,
    myImageType,
    opponentImageType,
    showResult,
    resultData,
    expGained,
    leveledUp,
    cardStats,
    isMyAttack,
    expProgress,
    animations: { damageAnim, numberAnim, shakeAnim, fieldAnim },
    selectAction,
  };
}
