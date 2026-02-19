import { View } from "react-native";

interface HpBarProps {
  current: number;
  max: number;
  /** NativeWind静的クラス（例: "bg-[#6c5ce7]"） */
  color?: string;
  /** 動的色指定時はこちらを使用（style.backgroundColor） */
  barColor?: string;
}

export function HpBar({ current, max, color, barColor }: HpBarProps) {
  const pct = Math.max(0, (current / max) * 100);
  return (
    <View className="w-full h-2.5 bg-[#0a0a15] rounded-full overflow-hidden">
      <View
        className={`h-full rounded-full ${color ?? ""}`}
        style={{ width: `${pct}%`, ...(barColor ? { backgroundColor: barColor } : undefined) }}
      />
    </View>
  );
}
