import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// キャラクター一覧取得
export async function GET() {
  const characters = await prisma.character.findMany({
    orderBy: { id: "asc" },
  });
  return NextResponse.json(characters);
}

// キャラクター作成
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "不正なJSONです" },
      { status: 400 }
    );
  }

  const { name, hp, attack, defense, imageUrl } = body as {
    name: string;
    hp: number;
    attack: number;
    defense: number;
    imageUrl?: string;
  };

  if (!name || hp == null || attack == null || defense == null) {
    return NextResponse.json(
      { error: "name, hp, attack, defense は必須です" },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(hp) || hp <= 0 ||
    !Number.isFinite(attack) || attack <= 0 ||
    !Number.isFinite(defense) || defense <= 0
  ) {
    return NextResponse.json(
      { error: "hp, attack, defense は正の数値である必要があります" },
      { status: 400 }
    );
  }

  try {
    const character = await prisma.character.create({
      data: { name, hp, attack, defense, imageUrl: imageUrl || null },
    });
    return NextResponse.json(character, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" && error !== null &&
      "code" in error && (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "同じ名前のキャラクターが既に存在します" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "キャラクターの作成に失敗しました" },
      { status: 500 }
    );
  }
}
