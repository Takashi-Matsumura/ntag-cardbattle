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
  const body = await request.json();
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

  const character = await prisma.character.create({
    data: { name, hp, attack, defense, imageUrl: imageUrl || null },
  });

  return NextResponse.json(character, { status: 201 });
}
