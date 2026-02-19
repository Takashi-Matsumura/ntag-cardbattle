import { useState, useRef, useEffect, useMemo } from "react";
import { View, Text, Animated, PanResponder, Vibration } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Character, CharacterImageType } from "@nfc-card-battle/shared";
import { BattleCard } from "./BattleCard";
import { HpBar } from "./HpBar";

interface ActionCardControllerProps {
  character: Character;
  currentHp: number;
  imageType: CharacterImageType;
  isAttackTurn: boolean;
  specialCooldown: number;
  actionSelected: boolean;
  onActionConfirm: (action: "attack" | "special" | "defend" | "counter") => void;
}

interface ActionDef {
  action: "attack" | "special" | "defend" | "counter";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
}

const ACTIONS: Record<"attack" | "defend", { right: ActionDef; left: ActionDef }> = {
  attack: {
    right: { action: "attack", label: "攻撃", icon: "flame", color: "#ef4444" },
    left: { action: "special", label: "必殺技", icon: "flash", color: "#f59e0b", subtitle: "1.8x" },
  },
  defend: {
    right: { action: "defend", label: "防御", icon: "shield", color: "#3b82f6", subtitle: "DEF x1.5" },
    left: { action: "counter", label: "カウンター", icon: "flash-outline", color: "#f97316", subtitle: "成功率30%" },
  },
};

const SNAP_THRESHOLD = 40;
const MAX_ROTATION = 90;
const TAP_DISTANCE = 5;
const TAP_DURATION = 200;

export function ActionCardController({
  character,
  currentHp,
  imageType,
  isAttackTurn,
  specialCooldown,
  actionSelected,
  onActionConfirm,
}: ActionCardControllerProps) {
  const [snappedDir, setSnappedDir] = useState<"left" | "right" | null>(null);
  const [cardLayout, setCardLayout] = useState({ width: 0, height: 0 });

  // アニメーション値
  const panX = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const blinkRef = useRef<Animated.CompositeAnimation | null>(null);

  // PanResponder用のRef（クロージャ問題回避）
  const snappedDirRef = useRef<"left" | "right" | null>(null);
  const isAttackTurnRef = useRef(isAttackTurn);
  const specialCooldownRef = useRef(specialCooldown);
  const actionSelectedRef = useRef(actionSelected);
  const onActionConfirmRef = useRef(onActionConfirm);

  useEffect(() => { isAttackTurnRef.current = isAttackTurn; }, [isAttackTurn]);
  useEffect(() => { specialCooldownRef.current = specialCooldown; }, [specialCooldown]);
  useEffect(() => { actionSelectedRef.current = actionSelected; }, [actionSelected]);
  useEffect(() => { onActionConfirmRef.current = onActionConfirm; }, [onActionConfirm]);

  // ターン切り替え時にリセット
  useEffect(() => {
    setSnappedDir(null);
    snappedDirRef.current = null;
    panX.setValue(0);
    if (blinkRef.current) blinkRef.current.stop();
    blinkAnim.setValue(1);
  }, [isAttackTurn]);

  // アクション確定時に点滅停止
  useEffect(() => {
    if (actionSelected) {
      if (blinkRef.current) blinkRef.current.stop();
      blinkAnim.setValue(1);
    }
  }, [actionSelected]);

  // unmount時にアニメーション停止
  useEffect(() => {
    return () => {
      if (blinkRef.current) blinkRef.current.stop();
    };
  }, []);

  const startBlink = () => {
    if (blinkRef.current) blinkRef.current.stop();
    blinkRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    blinkRef.current.start();
  };

  const snapTo = (dir: "left" | "right") => {
    const target = dir === "right" ? SNAP_THRESHOLD : -SNAP_THRESHOLD;
    Animated.spring(panX, {
      toValue: target,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
    setSnappedDir(dir);
    snappedDirRef.current = dir;
    startBlink();
  };

  const snapToCenter = () => {
    Animated.spring(panX, {
      toValue: 0,
      friction: 8,
      tension: 100,
      useNativeDriver: true,
    }).start();
    setSnappedDir(null);
    snappedDirRef.current = null;
    if (blinkRef.current) blinkRef.current.stop();
    blinkAnim.setValue(1);
  };

  const touchStartRef = useRef({ time: 0, x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !actionSelectedRef.current,
        onMoveShouldSetPanResponder: (_, gs) =>
          !actionSelectedRef.current && Math.abs(gs.dx) > 5,
        onPanResponderGrant: (e) => {
          touchStartRef.current = {
            time: Date.now(),
            x: e.nativeEvent.pageX,
            y: e.nativeEvent.pageY,
          };
        },
        onPanResponderMove: (_, gs) => {
          if (actionSelectedRef.current) return;
          const currentSnap = snappedDirRef.current;
          if (!currentSnap) {
            if (Math.abs(gs.dx) > SNAP_THRESHOLD) {
              snapTo(gs.dx > 0 ? "right" : "left");
            } else {
              panX.setValue(gs.dx);
            }
          } else {
            if (
              (currentSnap === "right" && gs.dx < -SNAP_THRESHOLD) ||
              (currentSnap === "left" && gs.dx > SNAP_THRESHOLD)
            ) {
              snapTo(gs.dx > 0 ? "right" : "left");
            }
          }
        },
        onPanResponderRelease: (_, gs) => {
          if (actionSelectedRef.current) return;
          const duration = Date.now() - touchStartRef.current.time;
          const dist = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);

          if (dist < TAP_DISTANCE && duration < TAP_DURATION) {
            const currentSnap = snappedDirRef.current;
            if (currentSnap) {
              const cfg = isAttackTurnRef.current ? ACTIONS.attack : ACTIONS.defend;
              const actionConfig = currentSnap === "right" ? cfg.right : cfg.left;
              if (
                isAttackTurnRef.current &&
                currentSnap === "left" &&
                specialCooldownRef.current > 0
              ) {
                Vibration.vibrate(50);
                return;
              }
              onActionConfirmRef.current(actionConfig.action);
            }
            return;
          }

          if (!snappedDirRef.current) {
            snapToCenter();
          }
        },
      }),
    []
  );

  // === 派生アニメーション ===

  // カード回転（0° → ±90°）
  const rotateZ = panX.interpolate({
    inputRange: [-SNAP_THRESHOLD, 0, SNAP_THRESHOLD],
    outputRange: [`-${MAX_ROTATION}deg`, "0deg", `${MAX_ROTATION}deg`],
    extrapolate: "clamp",
  });

  // BattleCard表示（中央で表示、回転が深くなるとフェードアウト）
  const normalOpacity = panX.interpolate({
    inputRange: [-SNAP_THRESHOLD * 0.7, -SNAP_THRESHOLD * 0.4, 0, SNAP_THRESHOLD * 0.4, SNAP_THRESHOLD * 0.7],
    outputRange: [0, 1, 1, 1, 0],
    extrapolate: "clamp",
  });

  // 右アクションカード表示（右傾き時にフェードイン）
  const rightActionOpacity = panX.interpolate({
    inputRange: [SNAP_THRESHOLD * 0.5, SNAP_THRESHOLD * 0.85],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // 左アクションカード表示（左傾き時にフェードイン）
  const leftActionOpacity = panX.interpolate({
    inputRange: [-SNAP_THRESHOLD * 0.85, -SNAP_THRESHOLD * 0.5],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const config = isAttackTurn ? ACTIONS.attack : ACTIONS.defend;
  const isSpecialDisabled = isAttackTurn && specialCooldown > 0;
  const { width: W, height: H } = cardLayout;

  return (
    <View className="w-full items-center" style={{ overflow: "visible" }}>
      {/* カードエリア */}
      <Animated.View
        {...panResponder.panHandlers}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0 && (width !== W || height !== H)) {
            setCardLayout({ width, height });
          }
        }}
        style={{
          width: "50%",
          overflow: "visible" as const,
          transform: [{ rotate: rotateZ }],
        }}
      >
        {/* BattleCard（通常表示・回転でフェードアウト） */}
        <Animated.View style={{ opacity: normalOpacity }}>
          <BattleCard
            character={character}
            currentHp={currentHp}
            variant="player"
            imageType={imageType}
          />
        </Animated.View>

        {/* 右アクションカード（右傾き時に表示、-90°カウンター回転） */}
        {H > 0 && (
          <Animated.View
            style={{
              position: "absolute",
              opacity: rightActionOpacity,
              width: H,
              height: W,
              left: (W - H) / 2,
              top: (H - W) / 2,
              transform: [{ rotate: "-90deg" }],
            }}
            pointerEvents="none"
          >
            <ActionCardContent
              label={config.right.label}
              icon={config.right.icon}
              color={config.right.color}
              subtitle={config.right.subtitle}
              character={character}
              currentHp={currentHp}
              showHpDetail={!isAttackTurn}
            />
          </Animated.View>
        )}

        {/* 左アクションカード（左傾き時に表示、+90°カウンター回転） */}
        {H > 0 && (
          <Animated.View
            style={{
              position: "absolute",
              opacity: leftActionOpacity,
              width: H,
              height: W,
              left: (W - H) / 2,
              top: (H - W) / 2,
              transform: [{ rotate: "90deg" }],
            }}
            pointerEvents="none"
          >
            <ActionCardContent
              label={config.left.label}
              icon={config.left.icon}
              color={isSpecialDisabled ? "#555" : config.left.color}
              subtitle={isSpecialDisabled ? `CT:${specialCooldown}` : config.left.subtitle}
              character={character}
              currentHp={currentHp}
              disabled={isSpecialDisabled}
              showHpDetail={!isAttackTurn}
            />
          </Animated.View>
        )}
      </Animated.View>

      {/* ヒント / 確定テキスト */}
      <View className="h-8 items-center justify-center mt-3">
        {actionSelected ? null : snappedDir ? (
          <Animated.Text
            className="text-gray-300 text-sm font-bold"
            style={{ opacity: blinkAnim }}
          >
            タップで確定
          </Animated.Text>
        ) : (
          <View className="flex-row items-center">
            <Ionicons name="arrow-back" size={12} color="#555" />
            <Text className="text-sm font-bold mx-1.5" style={{ color: config.left.color }}>
              {config.left.label}
            </Text>
            <Text className="text-gray-700 text-xs mx-1">│</Text>
            <Text className="text-sm font-bold mx-1.5" style={{ color: config.right.color }}>
              {config.right.label}
            </Text>
            <Ionicons name="arrow-forward" size={12} color="#555" />
          </View>
        )}
      </View>
    </View>
  );
}

/** 横向きアクションカード内容（カウンター回転されて読みやすく表示） */
function ActionCardContent({
  label,
  icon,
  color,
  subtitle,
  character,
  currentHp,
  disabled,
  showHpDetail,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
  character: Character;
  currentHp: number;
  disabled?: boolean;
  showHpDetail?: boolean;
}) {
  const displayColor = disabled ? "#555" : color;
  const hpPct = Math.round((currentHp / character.hp) * 100);
  const hpColor = hpPct > 50 ? "#6c5ce7" : hpPct > 25 ? "#f59e0b" : "#ef4444";

  return (
    <View
      className="flex-1 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "#0f0f1a",
        borderWidth: 2,
        borderColor: displayColor + "50",
      }}
    >
      {/* ヘッダー */}
      <View
        className="px-3 py-1.5 flex-row items-center justify-between"
        style={{ backgroundColor: displayColor }}
      >
        <View className="flex-row items-center">
          <Ionicons name="person" size={12} color="#fff" />
          <Text className="text-white font-bold text-xs ml-1.5">{character.name}</Text>
        </View>
        {!showHpDetail && (
          <Text className="text-white/70 text-[10px]">
            HP {currentHp}/{character.hp}
          </Text>
        )}
      </View>

      {/* アクション表示 */}
      <View
        className="flex-1 flex-row items-center px-4"
        style={{ backgroundColor: displayColor + "12", justifyContent: showHpDetail ? "flex-start" : "center" }}
      >
        {/* アクション情報（左側） */}
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: displayColor + "30" }}
        >
          <Ionicons name={icon} size={26} color={displayColor} />
        </View>
        <View>
          <Text className="text-xl font-black" style={{ color: displayColor }}>
            {label}
          </Text>
          {subtitle && (
            <Text className="text-xs mt-0.5" style={{ color: displayColor + "90" }}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* HP詳細（防御ターン時、右側に大きく表示） */}
        {showHpDetail && (
          <View className="ml-auto items-end">
            <View className="flex-row items-baseline">
              <Text className="text-2xl font-black" style={{ color: hpColor }}>
                {currentHp}
              </Text>
              <Text className="text-xs font-bold text-gray-600 ml-0.5">
                /{character.hp}
              </Text>
            </View>
            <View className="mt-1" style={{ width: 72 }}>
              <HpBar current={currentHp} max={character.hp} barColor={hpColor} />
            </View>
          </View>
        )}
      </View>

      {/* HPバー（攻撃ターン時のみ、小さく下部に表示） */}
      {!showHpDetail && (
        <View className="px-3 py-1.5">
          <HpBar current={currentHp} max={character.hp} barColor={displayColor} />
        </View>
      )}
    </View>
  );
}
