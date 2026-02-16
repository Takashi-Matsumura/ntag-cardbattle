import { NextResponse } from "next/server";

// ルーム作成（6桁のルームコード生成）
export async function POST() {
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  return NextResponse.json({ roomCode }, { status: 201 });
}
