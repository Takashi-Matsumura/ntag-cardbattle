import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// キャラクター更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) {
    return NextResponse.json(
      { error: "IDが不正です" },
      { status: 400 }
    );
  }

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
    name?: string;
    hp?: number;
    attack?: number;
    defense?: number;
    imageUrl?: string | null;
  };

  try {
    const character = await prisma.character.update({
      where: { id: numId },
      data: {
        ...(name !== undefined && { name }),
        ...(hp !== undefined && { hp }),
        ...(attack !== undefined && { attack }),
        ...(defense !== undefined && { defense }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
    });
    return NextResponse.json(character);
  } catch (error: unknown) {
    if (
      typeof error === "object" && error !== null &&
      "code" in error && (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { error: "キャラクターが見つかりません" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "キャラクターの更新に失敗しました" },
      { status: 500 }
    );
  }
}

// キャラクター削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numId = parseInt(id);
  if (isNaN(numId)) {
    return NextResponse.json(
      { error: "IDが不正です" },
      { status: 400 }
    );
  }

  try {
    await prisma.character.delete({
      where: { id: numId },
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (
      typeof error === "object" && error !== null &&
      "code" in error && (error as { code: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { error: "キャラクターが見つかりません" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "キャラクターの削除に失敗しました" },
      { status: 500 }
    );
  }
}
