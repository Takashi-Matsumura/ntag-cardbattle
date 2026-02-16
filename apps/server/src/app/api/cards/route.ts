import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// カード一覧取得
export async function GET() {
  const cards = await prisma.card.findMany({
    include: { character: true },
    orderBy: { registeredAt: "desc" },
  });
  return NextResponse.json(cards);
}

// カード登録（モバイルアプリから）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id } = body as { id: string };

  if (!id) {
    return NextResponse.json(
      { error: "カードUIDが必要です" },
      { status: 400 }
    );
  }

  // 既に登録済みか確認
  const existing = await prisma.card.findUnique({ where: { id } });
  if (existing) {
    return NextResponse.json(
      { error: "このカードは既に登録されています" },
      { status: 409 }
    );
  }

  const card = await prisma.card.create({
    data: { id },
    include: { character: true },
  });

  return NextResponse.json(card, { status: 201 });
}

// カードにキャラクター割当（管理画面から）
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, characterId } = body as { id: string; characterId: number | null };

  if (!id) {
    return NextResponse.json(
      { error: "カードUIDが必要です" },
      { status: 400 }
    );
  }

  const card = await prisma.card.update({
    where: { id },
    data: { characterId },
    include: { character: true },
  });

  return NextResponse.json(card);
}
