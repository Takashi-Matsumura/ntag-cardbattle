import { useState, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { readNfcUid, writeNfcData } from "@/lib/nfc";
import { useBattle } from "@/hooks/useBattle";
import { P2PHostTransport } from "@/lib/p2p-host-transport";
import { P2PGuestTransport } from "@/lib/p2p-guest-transport";
import { getLocalCard, saveLocalCard } from "@/lib/local-cards";
import { BattleCard } from "@/components/BattleCard";
import { ActionCardController } from "@/components/ActionCardController";

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

export default function P2PBattleScreen() {
  const { role } = useLocalSearchParams<{ role: "host" | "guest" }>();
  const router = useRouter();

  const transport = useMemo(() => {
    const name = `P2P_${Date.now()}`;
    if (role === "host") {
      return new P2PHostTransport(name);
    }
    return new P2PGuestTransport(name);
  }, [role]);

  const {
    phase,
    myCard,
    myLevel,
    opponentCard,
    opponentLevel,
    myHp,
    opponentHp,
    turn,
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
  } = useBattle(transport);

  const [scanning, setScanning] = useState(false);
  const [nfcWritePhase, setNfcWritePhase] = useState<"idle" | "writing" | "success" | "failed">("idle");
  const [scannedUid, setScannedUid] = useState<string | null>(null);

  // NFCスキャン → ローカルカードデータでP2P登録
  const scanCard = useCallback(async () => {
    setScanning(true);
    try {
      const uid = await readNfcUid();
      if (!uid) {
        Alert.alert("エラー", "カードを読み取れませんでした");
        setScanning(false);
        return;
      }

      const localCard = await getLocalCard(uid);
      if (!localCard) {
        Alert.alert(
          "未登録カード",
          "このカードは登録されていません。\n設定画面の「カード登録（ガチャ）」で先にカードを登録してください。"
        );
        setScanning(false);
        return;
      }

      setScannedUid(uid);

      // P2Pトランスポートにカード登録
      if (transport instanceof P2PHostTransport) {
        transport.registerLocalCard(localCard);
      } else if (transport instanceof P2PGuestTransport) {
        (transport as P2PGuestTransport).registerLocalCard(localCard);
      }
    } catch {
      Alert.alert("エラー", "スキャンに失敗しました");
    } finally {
      setScanning(false);
    }
  }, [transport]);

  // キャンセル
  const cancelBattle = () => {
    transport.leaveRoom();
    router.back();
  };

  // バトル終了後のローカルデータ保存
  const saveResult = useCallback(async () => {
    if (!scannedUid || !cardStats || !myRole) return;
    await saveLocalCard({
      cardUid: scannedUid,
      characterId: myCard?.id ?? 1,
      level: cardStats.level,
      exp: cardStats.exp,
      totalWins: cardStats.totalWins,
      totalLosses: cardStats.totalLosses,
    });
  }, [scannedUid, cardStats, myRole, myCard]);

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
    if (success) await saveResult();
  };

  // ========== Scan Phase ==========
  if (phase === "scan") {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-[#1a1a2e] rounded-3xl p-8 items-center w-full border border-[#2a2a4e]">
          <Ionicons name="bluetooth" size={56} color="#6c5ce7" />
          <Text className="text-white text-2xl font-bold mt-4">
            ローカル対戦
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

  // ========== Finished Phase ==========
  if (phase === "finished") {
    const isWin = winner === myRole;
    // 画面表示時にローカルデータを保存
    if (cardStats && scannedUid) {
      saveResult();
    }
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
              <View className="w-full h-3 bg-[#0f0f1a] rounded-full overflow-hidden">
                <View
                  className="h-full bg-[#6c5ce7] rounded-full"
                  style={{ width: `${Math.min(expProgress * 100, 100)}%` }}
                />
              </View>
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

      {/* ===== 上部: 相手カード ===== */}
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

      {/* ===== 中央: バトルフィールド ===== */}
      <View className="flex-1 px-6 justify-center items-center" style={{ zIndex: 10 }} pointerEvents="none">
        {showResult && resultData ? (
          <Animated.View
            className="items-center w-full"
            style={{
              opacity: damageAnim,
              transform: [{ translateX: shakeAnim }],
            }}
          >
            <Text className="text-gray-400 text-lg font-bold mb-2">
              {resultData.header}
            </Text>

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
