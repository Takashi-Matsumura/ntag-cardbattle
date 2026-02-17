import { View } from "react-native";

interface HpBarProps {
  current: number;
  max: number;
  color: string;
}

export function HpBar({ current, max, color }: HpBarProps) {
  const pct = Math.max(0, (current / max) * 100);
  return (
    <View className="w-full h-2.5 bg-[#0a0a15] rounded-full overflow-hidden">
      <View
        className={`h-full rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
