import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  runSimulation,
  getDefaultParams,
  getDefaultStrategy,
  type SimParams,
  type AIStrategy,
  type SimCharacter,
} from "@/game/simulator";

const MAX_TRIALS = 5000;

interface RequestBody {
  params?: Partial<SimParams>;
  strategy?: Partial<AIStrategy>;
  characterOverrides?: Record<
    number,
    Partial<{ hp: number; attack: number; defense: number }>
  >;
  trials?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RequestBody;

  // パラメータ構築
  const params: SimParams = {
    ...getDefaultParams(),
    ...body.params,
  };
  const strategy: AIStrategy = {
    ...getDefaultStrategy(),
    ...body.strategy,
  };
  const trials = Math.min(Math.max(body.trials ?? 1000, 1), MAX_TRIALS);

  // DB からキャラクター取得
  const dbCharacters = await prisma.character.findMany({
    orderBy: { id: "asc" },
  });

  if (dbCharacters.length === 0) {
    return NextResponse.json(
      { error: "キャラクターが登録されていません" },
      { status: 400 }
    );
  }

  // オーバーライド適用
  const characters: SimCharacter[] = dbCharacters.map((c) => {
    const override = body.characterOverrides?.[c.id];
    return {
      id: c.id,
      name: c.name,
      hp: override?.hp ?? c.hp,
      attack: override?.attack ?? c.attack,
      defense: override?.defense ?? c.defense,
    };
  });

  // シミュレーション実行
  const result = runSimulation(characters, params, strategy, trials);

  return NextResponse.json(result);
}
