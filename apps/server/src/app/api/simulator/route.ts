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
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "不正なJSONです" },
      { status: 400 }
    );
  }

  // パラメータのバリデーション
  if (body.params) {
    const vals = Object.values(body.params);
    if (vals.some((v) => typeof v === "number" && !Number.isFinite(v))) {
      return NextResponse.json(
        { error: "パラメータに不正な数値が含まれています" },
        { status: 400 }
      );
    }
  }

  try {
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
  } catch {
    return NextResponse.json(
      { error: "シミュレーションの実行に失敗しました" },
      { status: 500 }
    );
  }
}
