import { useState, useEffect, useRef } from "react";
import { View, Text, Image, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Character, CharacterImageType } from "@nfc-card-battle/shared";
import { getCharacterImageUrl } from "@nfc-card-battle/shared";
import { HpBar } from "./HpBar";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000";

/** タイプ別プレースホルダー設定 */
const IMAGE_TYPE_PLACEHOLDER: Record<
  CharacterImageType,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  idle: { icon: "person-outline", color: "#6c5ce7" },
  attack: { icon: "flame-outline", color: "#e94560" },
  defend: { icon: "shield-outline", color: "#3b82f6" },
  special: { icon: "flash-outline", color: "#f1c40f" },
  damaged: { icon: "alert-circle-outline", color: "#e94560" },
};

interface BattleCardProps {
  character: Character;
  currentHp: number;
  variant: "player" | "opponent";
  isCompact?: boolean;
  label?: string;
  imageType?: CharacterImageType;
  level?: number;
}

const VARIANT_CONFIG = {
  player: {
    color: "#6c5ce7",
    bgHeader: "bg-[#6c5ce7]",
    bgImage: "bg-[#6c5ce7]/10",
    textInitial: "text-[#6c5ce7]",
    hpBarColor: "bg-[#6c5ce7]",
    borderColor: "border-[#6c5ce7]/30",
    icon: "person" as const,
    defaultLabel: "あなた",
  },
  opponent: {
    color: "#e94560",
    bgHeader: "bg-[#e94560]",
    bgImage: "bg-[#e94560]/10",
    textInitial: "text-[#e94560]",
    hpBarColor: "bg-[#e94560]",
    borderColor: "border-[#e94560]/30",
    icon: "desktop-outline" as const,
    defaultLabel: "CPU",
  },
};

export function BattleCard({
  character,
  currentHp,
  variant,
  isCompact = false,
  label,
  imageType = "idle",
  level,
}: BattleCardProps) {
  const config = VARIANT_CONFIG[variant];
  const displayLabel = label ?? config.defaultLabel;
  const [imageError, setImageError] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  // imageType 変更時にエラー状態をリセット + アニメーション発火
  useEffect(() => {
    setImageError(false);

    // 初回レンダリング時はアニメーションしない
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // スケールバウンスアニメーション
    scaleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.15,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 140,
        useNativeDriver: true,
      }),
    ]).start();

    // damagedタイプの場合は横揺れも追加
    if (imageType === "damaged") {
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [imageType]);

  const imageUrl = getCharacterImageUrl(SERVER_URL, character.id, imageType);
  const placeholder = IMAGE_TYPE_PLACEHOLDER[imageType];

  return (
    <View
      className={`rounded-2xl overflow-hidden border ${config.borderColor} bg-[#0f0f1a]`}
    >
      {/* ヘッダー */}
      <View
        className={`${config.bgHeader} px-4 py-2 flex-row items-center justify-between`}
      >
        <View className="flex-row items-center">
          <Ionicons name={config.icon} size={16} color="#fff" />
          <Text className="text-white font-bold text-sm ml-2">
            {character.name}
          </Text>
          {level != null && (
            <View className="bg-white/20 px-1.5 py-0.5 rounded ml-2">
              <Text className="text-white text-[10px] font-bold">Lv.{level}</Text>
            </View>
          )}
        </View>
        <Text className="text-white/70 text-xs">{displayLabel}</Text>
      </View>

      {/* 画像エリア */}
      {!isCompact && (
        <View
          className={`${config.bgImage} items-center justify-center`}
          style={{ height: 120 }}
        >
          <Animated.View
            className="w-full h-full items-center justify-center"
            style={{
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
            }}
          >
            {!imageError ? (
              <Image
                source={{ uri: imageUrl }}
                className="w-full h-full"
                resizeMode="contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <View className="items-center justify-center">
                <Ionicons
                  name={placeholder.icon}
                  size={48}
                  color={placeholder.color}
                />
                <Text
                  className="text-gray-500 text-xs mt-1 font-bold"
                  style={{ textTransform: "uppercase" }}
                >
                  {imageType}
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      )}

      {/* HPバー */}
      <View className="px-3 pt-2.5 pb-2">
        <View className="flex-row items-center justify-between mb-1.5">
          <Text className="text-gray-500 text-xs font-bold">HP</Text>
          <Text className="text-gray-400 text-xs">
            {currentHp} / {character.hp}
          </Text>
        </View>
        <HpBar current={currentHp} max={character.hp} color={config.hpBarColor} />
      </View>

      {/* ステータスバッジ */}
      <View className="flex-row border-t border-[#1a1a2e]">
        <View className="flex-1 items-center py-2 border-r border-[#1a1a2e]">
          <Text className="text-gray-600 text-[10px]">攻撃</Text>
          <Text className="text-orange-400 font-bold text-sm">
            {character.attack}
          </Text>
        </View>
        <View className="flex-1 items-center py-2">
          <Text className="text-gray-600 text-[10px]">防御</Text>
          <Text className="text-blue-400 font-bold text-sm">
            {character.defense}
          </Text>
        </View>
      </View>
    </View>
  );
}
