import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// キャラクター更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, hp, attack, defense, imageUrl } = body as {
    name?: string;
    hp?: number;
    attack?: number;
    defense?: number;
    imageUrl?: string | null;
  };

  const character = await prisma.character.update({
    where: { id: parseInt(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(hp !== undefined && { hp }),
      ...(attack !== undefined && { attack }),
      ...(defense !== undefined && { defense }),
      ...(imageUrl !== undefined && { imageUrl }),
    },
  });

  return NextResponse.json(character);
}

// キャラクター削除
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.character.delete({
    where: { id: parseInt(id) },
  });

  return NextResponse.json({ success: true });
}
