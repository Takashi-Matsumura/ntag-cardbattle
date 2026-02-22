"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// --- 型定義 ---

interface Character {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
}

interface SimParams {
  defenseMultiplier: number;
  specialMultiplier: number;
  specialCooldown: number;
  counterSuccessRate: number;
  counterDamageMultiplier: number;
  damageVariance: number;
  minDamage: number;
}

interface AIStrategy {
  specialRate: number;
  counterRate: number;
}

interface MatchupResult {
  charA: string;
  charB: string;
  charAId: number;
  charBId: number;
  winsA: number;
  winsB: number;
  draws: number;
  total: number;
  winRateA: number;
  winRateB: number;
  drawRate: number;
  avgTurns: number;
  stalemateRate: number;
  avgDamagePerTurn: number;
}

interface SimulationResult {
  matrix: MatchupResult[];
  summary: {
    overallStalemateRate: number;
    avgTurns: number;
    firstMoverWinRate: number;
    executionMs: number;
  };
  characters: Character[];
}

// --- デフォルト値 ---

const DEFAULT_PARAMS: SimParams = {
  defenseMultiplier: 1.5,
  specialMultiplier: 1.8,
  specialCooldown: 3,
  counterSuccessRate: 0.3,
  counterDamageMultiplier: 1.5,
  damageVariance: 0.15,
  minDamage: 1,
};

const DEFAULT_STRATEGY: AIStrategy = {
  specialRate: 0.5,
  counterRate: 0.3,
};

// --- ヒートマップ色計算 ---

function getWinRateColor(winRateA: number, drawRate: number): string {
  if (drawRate > 0.5) return "bg-gray-200";
  if (winRateA > 0.7) return "bg-red-400 text-white";
  if (winRateA > 0.6) return "bg-red-300";
  if (winRateA > 0.55) return "bg-red-200";
  if (winRateA >= 0.45) return "bg-gray-100";
  if (winRateA >= 0.4) return "bg-blue-200";
  if (winRateA >= 0.3) return "bg-blue-300";
  return "bg-blue-400 text-white";
}

// --- 期待ダメージ計算（UI側） ---

function calcExpectedDamage(
  atk: number,
  def: number,
  defMul: number
): number {
  return Math.max(atk - def * defMul, 0);
}

// --- コンポーネント ---

export default function SimulatorPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [charOverrides, setCharOverrides] = useState<
    Record<number, { hp: number; attack: number; defense: number }>
  >({});
  const [params, setParams] = useState<SimParams>({ ...DEFAULT_PARAMS });
  const [strategy, setStrategy] = useState<AIStrategy>({
    ...DEFAULT_STRATEGY,
  });
  const [trials, setTrials] = useState(1000);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<MatchupResult | null>(null);

  // キャラクター取得
  useEffect(() => {
    fetch("/api/characters")
      .then((r) => r.json())
      .then((chars: Character[]) => {
        setCharacters(chars);
        const overrides: Record<
          number,
          { hp: number; attack: number; defense: number }
        > = {};
        for (const c of chars) {
          overrides[c.id] = { hp: c.hp, attack: c.attack, defense: c.defense };
        }
        setCharOverrides(overrides);
        setFetching(false);
      });
  }, []);

  // シミュレーション実行
  const runSim = async () => {
    setLoading(true);
    setHoveredCell(null);
    const characterOverrides: Record<
      number,
      Partial<{ hp: number; attack: number; defense: number }>
    > = {};
    for (const c of characters) {
      const ov = charOverrides[c.id];
      if (ov && (ov.hp !== c.hp || ov.attack !== c.attack || ov.defense !== c.defense)) {
        characterOverrides[c.id] = {};
        if (ov.hp !== c.hp) characterOverrides[c.id].hp = ov.hp;
        if (ov.attack !== c.attack) characterOverrides[c.id].attack = ov.attack;
        if (ov.defense !== c.defense) characterOverrides[c.id].defense = ov.defense;
      }
    }

    const res = await fetch("/api/simulator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        params,
        strategy,
        characterOverrides:
          Object.keys(characterOverrides).length > 0
            ? characterOverrides
            : undefined,
        trials,
      }),
    });
    const data: SimulationResult = await res.json();
    setResult(data);
    setLoading(false);
  };

  // オーバーライド値更新
  const updateOverride = (
    id: number,
    field: "hp" | "attack" | "defense",
    value: number
  ) => {
    setCharOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  // オーバーライドがDB値と異なるか判定
  const isModified = (id: number, field: "hp" | "attack" | "defense") => {
    const orig = characters.find((c) => c.id === id);
    if (!orig) return false;
    return charOverrides[id]?.[field] !== orig[field];
  };

  // キャラクター別の総合勝率計算
  const getCharWinRates = () => {
    if (!result) return [];
    const chars = result.characters;
    return chars
      .map((c) => {
        const matchups = result.matrix.filter(
          (m) => m.charAId === c.id && m.charBId !== c.id
        );
        const totalWins = matchups.reduce((sum, m) => sum + m.winsA, 0);
        const totalGames = matchups.reduce((sum, m) => sum + m.total, 0);
        return {
          ...c,
          winRate: totalGames > 0 ? totalWins / totalGames : 0,
          totalGames,
        };
      })
      .sort((a, b) => b.winRate - a.winRate);
  };

  // 膠着マッチアップ一覧
  const getStalemateMatchups = () => {
    if (!result) return [];
    return result.matrix
      .filter((m) => m.charAId !== m.charBId)
      .filter((m) => m.stalemateRate > 0 || m.avgTurns > 50)
      .sort((a, b) => b.stalemateRate - a.stalemateRate || b.avgTurns - a.avgTurns)
      .slice(0, 20);
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const charNames = result?.characters ?? characters;
  const winRates = getCharWinRates();
  const stalemateMatchups = getStalemateMatchups();

  return (
    <main className="max-w-6xl mx-auto p-8">
      <Link href="/" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        ← ホームに戻る
      </Link>
      <h1 className="text-3xl font-bold mb-8">バトルシミュレーター</h1>

      {/* --- パラメータ設定パネル --- */}
      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">パラメータ設定</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600">防御倍率</label>
            <input
              type="number"
              step="0.1"
              value={params.defenseMultiplier}
              onChange={(e) =>
                setParams({ ...params, defenseMultiplier: parseFloat(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">必殺倍率</label>
            <input
              type="number"
              step="0.1"
              value={params.specialMultiplier}
              onChange={(e) =>
                setParams({ ...params, specialMultiplier: parseFloat(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">必殺CT</label>
            <input
              type="number"
              value={params.specialCooldown}
              onChange={(e) =>
                setParams({ ...params, specialCooldown: parseInt(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">カウンター成功率</label>
            <input
              type="number"
              step="0.05"
              value={params.counterSuccessRate}
              onChange={(e) =>
                setParams({ ...params, counterSuccessRate: parseFloat(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">カウンター倍率</label>
            <input
              type="number"
              step="0.1"
              value={params.counterDamageMultiplier}
              onChange={(e) =>
                setParams({
                  ...params,
                  counterDamageMultiplier: parseFloat(e.target.value) || 0,
                })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">ダメージ変動幅</label>
            <input
              type="number"
              step="0.05"
              value={params.damageVariance}
              onChange={(e) =>
                setParams({ ...params, damageVariance: parseFloat(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">最低ダメージ</label>
            <input
              type="number"
              value={params.minDamage}
              onChange={(e) =>
                setParams({ ...params, minDamage: parseInt(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
        </div>

        {/* AI戦略 */}
        <h3 className="text-lg font-medium mb-2">AI戦略</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600">必殺技選択率</label>
            <input
              type="number"
              step="0.1"
              value={strategy.specialRate}
              onChange={(e) =>
                setStrategy({ ...strategy, specialRate: parseFloat(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">カウンター選択率</label>
            <input
              type="number"
              step="0.1"
              value={strategy.counterRate}
              onChange={(e) =>
                setStrategy({ ...strategy, counterRate: parseFloat(e.target.value) || 0 })
              }
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">試行回数</label>
            <input
              type="number"
              value={trials}
              onChange={(e) => setTrials(parseInt(e.target.value) || 100)}
              min={1}
              max={5000}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={runSim}
              disabled={loading || characters.length === 0}
              className="bg-blue-600 text-white px-6 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full"
            >
              {loading ? "実行中..." : "シミュレーション実行"}
            </button>
          </div>
        </div>
      </section>

      {/* --- キャラクターステータス調整 --- */}
      <section className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">キャラクターステータス調整</h2>
        {characters.length === 0 ? (
          <p className="text-gray-500">キャラクターが登録されていません</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-gray-600">
                <th className="p-2">名前</th>
                <th className="p-2">HP</th>
                <th className="p-2">攻撃</th>
                <th className="p-2">防御</th>
                <th className="p-2">通常ATK vs DEF期待値</th>
              </tr>
            </thead>
            <tbody>
              {characters.map((c) => {
                const ov = charOverrides[c.id] ?? {
                  hp: c.hp,
                  attack: c.attack,
                  defense: c.defense,
                };
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={ov.hp}
                        onChange={(e) =>
                          updateOverride(c.id, "hp", parseInt(e.target.value) || 0)
                        }
                        className={`border rounded px-2 py-1 w-20 ${
                          isModified(c.id, "hp")
                            ? "border-yellow-400 bg-yellow-50"
                            : ""
                        }`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={ov.attack}
                        onChange={(e) =>
                          updateOverride(c.id, "attack", parseInt(e.target.value) || 0)
                        }
                        className={`border rounded px-2 py-1 w-20 ${
                          isModified(c.id, "attack")
                            ? "border-yellow-400 bg-yellow-50"
                            : ""
                        }`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={ov.defense}
                        onChange={(e) =>
                          updateOverride(c.id, "defense", parseInt(e.target.value) || 0)
                        }
                        className={`border rounded px-2 py-1 w-20 ${
                          isModified(c.id, "defense")
                            ? "border-yellow-400 bg-yellow-50"
                            : ""
                        }`}
                      />
                    </td>
                    <td className="p-2 text-sm text-gray-500">
                      ATK {ov.attack} - DEF×{params.defenseMultiplier} ={" "}
                      <span
                        className={
                          calcExpectedDamage(ov.attack, ov.defense, params.defenseMultiplier) === 0
                            ? "text-red-500 font-bold"
                            : "text-green-600"
                        }
                      >
                        {calcExpectedDamage(ov.attack, ov.defense, params.defenseMultiplier)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* --- 結果表示 --- */}
      {result && (
        <>
          {/* サマリー指標 */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500">全体膠着率</p>
              <p className="text-2xl font-bold">
                {(result.summary.overallStalemateRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500">平均ターン数</p>
              <p className="text-2xl font-bold">
                {result.summary.avgTurns.toFixed(1)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500">先攻勝率</p>
              <p className="text-2xl font-bold">
                {(result.summary.firstMoverWinRate * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow text-center">
              <p className="text-sm text-gray-500">実行時間</p>
              <p className="text-2xl font-bold">
                {result.summary.executionMs}ms
              </p>
            </div>
          </section>

          {/* 勝率マトリクス */}
          <section className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">勝率マトリクス（A→行, B→列）</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">A＼B</th>
                    {charNames.map((c) => (
                      <th key={c.id} className="p-2 text-center">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {charNames.map((rowChar) => (
                    <tr key={rowChar.id} className="border-t">
                      <td className="p-2 font-medium">{rowChar.name}</td>
                      {charNames.map((colChar) => {
                        const m = result.matrix.find(
                          (x) =>
                            x.charAId === rowChar.id &&
                            x.charBId === colChar.id
                        );
                        if (!m) return <td key={colChar.id} className="p-2">-</td>;
                        const isMirror = rowChar.id === colChar.id;
                        return (
                          <td
                            key={colChar.id}
                            className={`p-2 text-center cursor-pointer transition-opacity ${
                              isMirror
                                ? "bg-gray-50 text-gray-400"
                                : getWinRateColor(m.winRateA, m.drawRate)
                            }`}
                            onMouseEnter={() => setHoveredCell(m)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {(m.winRateA * 100).toFixed(0)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ホバー詳細 */}
            {hoveredCell && (
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium">
                  {hoveredCell.charA} vs {hoveredCell.charB}
                </p>
                <p>
                  A勝率: {(hoveredCell.winRateA * 100).toFixed(1)}% / B勝率:{" "}
                  {(hoveredCell.winRateB * 100).toFixed(1)}% / 引分:{" "}
                  {(hoveredCell.drawRate * 100).toFixed(1)}%
                </p>
                <p>
                  平均ターン: {hoveredCell.avgTurns.toFixed(1)} / 膠着率:{" "}
                  {(hoveredCell.stalemateRate * 100).toFixed(1)}% / 平均DMG/ターン:{" "}
                  {hoveredCell.avgDamagePerTurn.toFixed(1)}
                </p>
              </div>
            )}
          </section>

          {/* キャラクター総合勝率ランキング */}
          <section className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">
              キャラクター総合勝率ランキング
            </h2>
            <div className="space-y-2">
              {winRates.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-6 text-right text-gray-400 font-mono">
                    {i + 1}
                  </span>
                  <span className="w-24 font-medium truncate">{c.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                    <div
                      className="bg-blue-500 h-6 rounded-full transition-all"
                      style={{ width: `${c.winRate * 100}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                      {(c.winRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 膠着マッチアップ一覧 */}
          {stalemateMatchups.length > 0 && (
            <section className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-semibold mb-4">
                膠着マッチアップ一覧
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="p-2">対戦</th>
                    <th className="p-2">膠着率</th>
                    <th className="p-2">平均ターン</th>
                    <th className="p-2">A勝率</th>
                    <th className="p-2">通常ATK→DEF期待値</th>
                  </tr>
                </thead>
                <tbody>
                  {stalemateMatchups.map((m, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2 font-medium">
                        {m.charA} vs {m.charB}
                      </td>
                      <td
                        className={`p-2 ${
                          m.stalemateRate > 0.3
                            ? "text-red-600 font-bold"
                            : ""
                        }`}
                      >
                        {(m.stalemateRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-2">{m.avgTurns.toFixed(1)}</td>
                      <td className="p-2">
                        {(m.winRateA * 100).toFixed(1)}%
                      </td>
                      <td className="p-2">
                        {(() => {
                          const a = charOverrides[m.charAId];
                          const b = charOverrides[m.charBId];
                          if (!a || !b) return "-";
                          const dmgAtoB = calcExpectedDamage(
                            a.attack,
                            b.defense,
                            params.defenseMultiplier
                          );
                          const dmgBtoA = calcExpectedDamage(
                            b.attack,
                            a.defense,
                            params.defenseMultiplier
                          );
                          return (
                            <span>
                              A→B:{" "}
                              <span
                                className={
                                  dmgAtoB === 0
                                    ? "text-red-500 font-bold"
                                    : ""
                                }
                              >
                                {dmgAtoB}
                              </span>{" "}
                              / B→A:{" "}
                              <span
                                className={
                                  dmgBtoA === 0
                                    ? "text-red-500 font-bold"
                                    : ""
                                }
                              >
                                {dmgBtoA}
                              </span>
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </main>
  );
}
