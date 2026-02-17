import type { ActionType, TurnType, ResultType } from "@nfc-card-battle/shared";
import {
  DEFENSE_MULTIPLIER,
  SPECIAL_MULTIPLIER,
  SPECIAL_COOLDOWN,
  COUNTER_SUCCESS_RATE,
  COUNTER_DAMAGE_MULTIPLIER,
  DAMAGE_VARIANCE,
  MIN_DAMAGE,
} from "@nfc-card-battle/shared";

// --- 型定義 ---

export interface SimCharacter {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defense: number;
}

export interface SimParams {
  defenseMultiplier: number;
  specialMultiplier: number;
  specialCooldown: number;
  counterSuccessRate: number;
  counterDamageMultiplier: number;
  damageVariance: number;
  minDamage: number;
}

export interface AIStrategy {
  specialRate: number; // 必殺技選択率（CT=0のとき）
  counterRate: number; // カウンター選択率
}

export interface MatchupResult {
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
  stalemateRate: number; // 膠着率（最大ターン到達）
  avgDamagePerTurn: number;
}

export interface SimulationResult {
  matrix: MatchupResult[];
  summary: {
    overallStalemateRate: number;
    avgTurns: number;
    firstMoverWinRate: number; // 先攻（A）勝率
    executionMs: number;
  };
  characters: SimCharacter[];
}

// --- ダメージ変動（パラメータ化版） ---

function varyDamage(baseDamage: number, params: SimParams): number {
  if (baseDamage === 0) return 0;
  const variance = 1 + (Math.random() * 2 - 1) * params.damageVariance;
  return Math.max(Math.round(baseDamage * variance), params.minDamage);
}

// --- シミュレーション用プレイヤー状態 ---

interface SimPlayer {
  hp: number;
  attack: number;
  defense: number;
  specialCd: number;
}

// --- パラメータ化されたターン処理 ---

function resolveTurn(
  turnType: TurnType,
  attacker: SimPlayer,
  defender: SimPlayer,
  attackerAction: ActionType,
  defenderAction: ActionType,
  params: SimParams
): {
  damageToDefender: number;
  damageToAttacker: number;
  resultType: ResultType;
  attackerCdAfter: number;
  defenderCdAfter: number;
} {
  let damageToDefender = 0;
  let damageToAttacker = 0;
  let resultType: ResultType = "deal";
  let attackerCdAfter = Math.max(attacker.specialCd - 1, 0);
  let defenderCdAfter = Math.max(defender.specialCd - 1, 0);

  const isSpecial = attackerAction === "special";
  const atkPower = isSpecial
    ? Math.floor(attacker.attack * params.specialMultiplier)
    : attacker.attack;

  if (isSpecial) {
    attackerCdAfter = params.specialCooldown;
  }

  if (defenderAction === "counter") {
    const success = Math.random() < params.counterSuccessRate;
    if (success) {
      damageToAttacker = varyDamage(
        Math.floor(defender.attack * params.counterDamageMultiplier),
        params
      );
      resultType = "counter_ok";
    } else {
      damageToDefender = varyDamage(atkPower, params);
      resultType = "counter_fail";
    }
  } else {
    // 防御
    const reduced = varyDamage(
      Math.max(atkPower - defender.defense * params.defenseMultiplier, 0),
      params
    );
    if (reduced > 0) {
      damageToDefender = reduced;
      resultType = "defend";
    } else {
      damageToDefender = 0;
      resultType = "perfect";
    }
  }

  return {
    damageToDefender,
    damageToAttacker,
    resultType,
    attackerCdAfter,
    defenderCdAfter,
  };
}

// --- AI行動選択 ---

function chooseAttackAction(
  specialCd: number,
  strategy: AIStrategy
): ActionType {
  if (specialCd === 0 && Math.random() < strategy.specialRate) {
    return "special";
  }
  return "attack";
}

function chooseDefendAction(strategy: AIStrategy): ActionType {
  if (Math.random() < strategy.counterRate) {
    return "counter";
  }
  return "defend";
}

// --- 1試合シミュレーション ---

const MAX_TURNS = 200;

function simulateBattle(
  charA: SimCharacter,
  charB: SimCharacter,
  params: SimParams,
  strategy: AIStrategy
): { winner: "A" | "B" | "draw"; turns: number; totalDamage: number } {
  const playerA: SimPlayer = {
    hp: charA.hp,
    attack: charA.attack,
    defense: charA.defense,
    specialCd: 0,
  };
  const playerB: SimPlayer = {
    hp: charB.hp,
    attack: charB.attack,
    defense: charB.defense,
    specialCd: 0,
  };

  let totalDamage = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const turnType: TurnType = turn % 2 === 1 ? "A_attacks" : "B_attacks";
    const attacker = turnType === "A_attacks" ? playerA : playerB;
    const defender = turnType === "A_attacks" ? playerB : playerA;

    const attackerAction = chooseAttackAction(attacker.specialCd, strategy);
    const defenderAction = chooseDefendAction(strategy);

    const result = resolveTurn(
      turnType,
      attacker,
      defender,
      attackerAction,
      defenderAction,
      params
    );

    attacker.specialCd = result.attackerCdAfter;
    defender.specialCd = result.defenderCdAfter;
    attacker.hp = Math.max(attacker.hp - result.damageToAttacker, 0);
    defender.hp = Math.max(defender.hp - result.damageToDefender, 0);
    totalDamage += result.damageToDefender + result.damageToAttacker;

    if (defender.hp <= 0) {
      return {
        winner: turnType === "A_attacks" ? "A" : "B",
        turns: turn,
        totalDamage,
      };
    }
    if (attacker.hp <= 0) {
      return {
        winner: turnType === "A_attacks" ? "B" : "A",
        turns: turn,
        totalDamage,
      };
    }
  }

  return { winner: "draw", turns: MAX_TURNS, totalDamage };
}

// --- 全マッチアップシミュレーション ---

export function getDefaultParams(): SimParams {
  return {
    defenseMultiplier: DEFENSE_MULTIPLIER,
    specialMultiplier: SPECIAL_MULTIPLIER,
    specialCooldown: SPECIAL_COOLDOWN,
    counterSuccessRate: COUNTER_SUCCESS_RATE,
    counterDamageMultiplier: COUNTER_DAMAGE_MULTIPLIER,
    damageVariance: DAMAGE_VARIANCE,
    minDamage: MIN_DAMAGE,
  };
}

export function getDefaultStrategy(): AIStrategy {
  return {
    specialRate: 0.5,
    counterRate: 0.3,
  };
}

// 通常攻撃 vs 防御の期待ダメージ（膠着分析用）
export function calcExpectedDamage(
  attackerAtk: number,
  defenderDef: number,
  params: SimParams
): number {
  const raw = attackerAtk - defenderDef * params.defenseMultiplier;
  return Math.max(raw, 0);
}

export function runSimulation(
  characters: SimCharacter[],
  params: SimParams,
  strategy: AIStrategy,
  trials: number
): SimulationResult {
  const startTime = Date.now();
  const matrix: MatchupResult[] = [];

  let totalStalemateCount = 0;
  let totalTurnsSum = 0;
  let totalMatches = 0;
  let totalFirstMoverWins = 0;

  for (let i = 0; i < characters.length; i++) {
    for (let j = 0; j < characters.length; j++) {
      const charA = characters[i];
      const charB = characters[j];

      let winsA = 0;
      let winsB = 0;
      let draws = 0;
      let turnsSum = 0;
      let totalDmgSum = 0;

      for (let t = 0; t < trials; t++) {
        const result = simulateBattle(charA, charB, params, strategy);
        if (result.winner === "A") winsA++;
        else if (result.winner === "B") winsB++;
        else draws++;
        turnsSum += result.turns;
        totalDmgSum += result.totalDamage;
      }

      const stalemateCount = draws;
      totalStalemateCount += stalemateCount;
      totalTurnsSum += turnsSum;
      totalMatches += trials;
      totalFirstMoverWins += winsA;

      matrix.push({
        charA: charA.name,
        charB: charB.name,
        charAId: charA.id,
        charBId: charB.id,
        winsA,
        winsB,
        draws,
        total: trials,
        winRateA: winsA / trials,
        winRateB: winsB / trials,
        drawRate: draws / trials,
        avgTurns: turnsSum / trials,
        stalemateRate: stalemateCount / trials,
        avgDamagePerTurn: turnsSum > 0 ? totalDmgSum / turnsSum : 0,
      });
    }
  }

  const executionMs = Date.now() - startTime;

  return {
    matrix,
    summary: {
      overallStalemateRate:
        totalMatches > 0 ? totalStalemateCount / totalMatches : 0,
      avgTurns: totalMatches > 0 ? totalTurnsSum / totalMatches : 0,
      firstMoverWinRate:
        totalMatches > 0 ? totalFirstMoverWins / totalMatches : 0,
      executionMs,
    },
    characters,
  };
}
