import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Character,
  TurnType,
  BattleEndData,
} from "@nfc-card-battle/shared";
import {
  TURN_TIME_LIMIT,
  getEffectiveStats,
  calcLevel,
  calcExpGain,
} from "@nfc-card-battle/shared";
import { roomManager, type Room } from "./room-manager";
import { resolveTurnBased } from "./engine";
import { prisma } from "../lib/prisma";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ターン開始
function startTurn(io: IO, room: Room) {
  room.state.currentTurn++;
  roomManager.resetActions(room);

  // 初ターンはA_attacks、以降は交互
  if (room.state.currentTurn > 1) {
    roomManager.toggleTurnType(room);
  }

  const turnType = room.state.turnType;

  // 各プレイヤーにターン開始を通知（roleを含む）
  io.to(room.playerA.socketId).emit("battle_start", {
    turn: room.state.currentTurn,
    timeLimit: TURN_TIME_LIMIT,
    turnType,
    role: "A",
    specialCd: room.playerA.specialCd,
  });
  if (room.playerB) {
    io.to(room.playerB.socketId).emit("battle_start", {
      turn: room.state.currentTurn,
      timeLimit: TURN_TIME_LIMIT,
      turnType,
      role: "B",
      specialCd: room.playerB.specialCd,
    });
  }

  // タイムアウト処理
  room.turnTimer = setTimeout(() => {
    const turnType = room.state.turnType;
    const attackerRole = turnType === "A_attacks" ? "A" : "B";
    const defenderRole = attackerRole === "A" ? "B" : "A";

    const attacker = attackerRole === "A" ? room.playerA : room.playerB;
    const defender = defenderRole === "A" ? room.playerA : room.playerB;

    if (attacker && attacker.action === null) {
      attacker.action = "timeout";
    }
    if (defender && defender.action === null) {
      defender.action = "timeout";
    }
    processTurn(io, room);
  }, TURN_TIME_LIMIT * 1000);
}

// ターン処理
async function processTurn(io: IO, room: Room) {
  // 二重実行防止
  if (room.turnProcessing) return;
  room.turnProcessing = true;

  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  if (
    !room.state.playerA ||
    !room.state.playerB ||
    !room.playerB
  ) {
    room.turnProcessing = false;
    return;
  }

  const turnType = room.state.turnType;
  const attackerRole = turnType === "A_attacks" ? "A" : "B";

  const attackerSlot = attackerRole === "A" ? room.playerA : room.playerB;
  const defenderSlot = attackerRole === "A" ? room.playerB : room.playerA;
  const attackerState = attackerRole === "A" ? room.state.playerA : room.state.playerB;
  const defenderState = attackerRole === "A" ? room.state.playerB : room.state.playerA;

  if (!attackerSlot || !defenderSlot || !attackerState || !defenderState) {
    room.turnProcessing = false;
    return;
  }

  const result = resolveTurnBased(
    room.state.currentTurn,
    turnType,
    {
      hp: attackerState.hp,
      attack: attackerState.card.attack,
      defense: attackerState.card.defense,
      specialCd: attackerSlot.specialCd,
    },
    {
      hp: defenderState.hp,
      attack: defenderState.card.attack,
      defense: defenderState.card.defense,
      specialCd: defenderSlot.specialCd,
    },
    attackerSlot.action!,
    defenderSlot.action!
  );

  // HP更新
  room.state.playerA.hp = result.playerA.hpAfter;
  room.state.playerB.hp = result.playerB.hpAfter;

  // クールダウン更新
  room.playerA.specialCd = result.playerA.specialCd;
  room.playerB.specialCd = result.playerB.specialCd;

  // ターン結果を送信
  io.to(room.playerA.socketId).emit("turn_result", result);
  io.to(room.playerB.socketId).emit("turn_result", result);

  // 勝敗判定
  const aAlive = room.state.playerA.hp > 0;
  const bAlive = room.state.playerB.hp > 0;

  if (!aAlive || !bAlive) {
    room.state.status = "finished";
    let winner: "A" | "B";
    if (!aAlive && !bAlive) {
      winner = "A"; // 同時KOはA勝利
    } else {
      winner = aAlive ? "A" : "B";
    }

    // EXP計算（戦力差で変動）+ DB保存
    const statsA = room.state.playerA.card;
    const statsB = room.state.playerB.card;
    const expA = calcExpGain(winner === "A", statsA, statsB);
    const expB = calcExpGain(winner === "B", statsB, statsA);

    let updatedA: { level: number; exp: number; totalWins: number; totalLosses: number } | null = null;
    let updatedB: { level: number; exp: number; totalWins: number; totalLosses: number } | null = null;

    try {
      const [resultA, resultB] = await Promise.all([
        room.playerA.cardUid
          ? prisma.card.update({
              where: { id: room.playerA.cardUid },
              data: {
                exp: { increment: expA },
                totalWins: { increment: winner === "A" ? 1 : 0 },
                totalLosses: { increment: winner === "A" ? 0 : 1 },
              },
            }).then((c) => {
              const newLevel = calcLevel(c.exp);
              if (newLevel !== c.level) {
                return prisma.card.update({
                  where: { id: c.id },
                  data: { level: newLevel },
                });
              }
              return c;
            })
          : null,
        room.playerB.cardUid
          ? prisma.card.update({
              where: { id: room.playerB.cardUid },
              data: {
                exp: { increment: expB },
                totalWins: { increment: winner === "B" ? 1 : 0 },
                totalLosses: { increment: winner === "B" ? 0 : 1 },
              },
            }).then((c) => {
              const newLevel = calcLevel(c.exp);
              if (newLevel !== c.level) {
                return prisma.card.update({
                  where: { id: c.id },
                  data: { level: newLevel },
                });
              }
              return c;
            })
          : null,
      ]);
      updatedA = resultA;
      updatedB = resultB;
    } catch (err) {
      console.error("バトル結果のDB保存に失敗:", err);
    }

    const endData: BattleEndData = {
      winner,
      finalState: room.state,
      expGained: { A: updatedA ? expA : 0, B: updatedB ? expB : 0 },
      levelUp: {
        A: updatedA ? updatedA.level > room.playerA.cardLevel : false,
        B: updatedB ? updatedB.level > room.playerB.cardLevel : false,
      },
      cardStats: {
        A: {
          level: updatedA?.level ?? room.playerA.cardLevel,
          exp: updatedA?.exp ?? room.playerA.cardExp,
          totalWins: updatedA?.totalWins ?? room.playerA.cardWins,
          totalLosses: updatedA?.totalLosses ?? room.playerA.cardLosses,
        },
        B: {
          level: updatedB?.level ?? room.playerB.cardLevel,
          exp: updatedB?.exp ?? room.playerB.cardExp,
          totalWins: updatedB?.totalWins ?? room.playerB.cardWins,
          totalLosses: updatedB?.totalLosses ?? room.playerB.cardLosses,
        },
      },
    };

    io.to(room.playerA.socketId).emit("battle_end", endData);
    io.to(room.playerB.socketId).emit("battle_end", endData);

    roomManager.removeRoom(room.code);
  } else {
    // 次のターンへ
    room.turnProcessing = false;
    setTimeout(() => startTurn(io, room), 2000);
  }
}

// バトル開始可能か確認
function tryStartBattle(io: IO, room: Room) {
  if (
    room.state.playerA &&
    room.state.playerB &&
    room.state.status === "ready"
  ) {
    room.state.status = "battle";
    startTurn(io, room);
  }
}

export function setupSocketHandlers(io: IO) {
  io.on("connection", (socket: ClientSocket) => {
    console.log(`接続: ${socket.id}`);

    // ルーム作成
    socket.on("create_room", () => {
      const room = roomManager.createRoom(socket.id);
      socket.emit("room_created", { roomCode: room.code });
      console.log(`ルーム作成: ${room.code} by ${socket.id}`);
    });

    // ルーム参加
    socket.on("join_room", ({ roomCode }) => {
      const room = roomManager.joinRoom(roomCode, socket.id);
      if (!room) {
        socket.emit("error", { message: "ルームが見つかりません" });
        return;
      }
      // Player Aに対戦相手参加を通知
      io.to(room.playerA.socketId).emit("opponent_joined");
      console.log(`ルーム参加: ${roomCode} by ${socket.id}`);
    });

    // カード登録（バトル前）
    socket.on("register_card", async ({ cardUid, token }) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) {
        socket.emit("error", { message: "ルームに参加していません" });
        return;
      }

      // 同一カードが他ルームで使用中でないか確認
      if (roomManager.isCardUidInUse(cardUid)) {
        socket.emit("error", { message: "このカードは現在別のバトルで使用中です" });
        return;
      }

      // DBからカード情報取得
      const card = await prisma.card.findUnique({
        where: { id: cardUid },
        include: { character: true },
      });

      if (!card || !card.character) {
        socket.emit("error", {
          message: "カードが未登録またはキャラクター未割当です",
        });
        return;
      }

      // トークン検証（所有者確認）
      if (card.token !== token) {
        socket.emit("error", { message: "カードの認証に失敗しました" });
        return;
      }

      // レベル補正を適用
      const stats = getEffectiveStats(
        card.character.hp,
        card.character.attack,
        card.character.defense,
        card.level
      );

      const character: Character = {
        id: card.character.id,
        name: card.character.name,
        hp: stats.hp,
        attack: stats.attack,
        defense: stats.defense,
        imageUrl: card.character.imageUrl,
      };

      const role = roomManager.getPlayerRole(room, socket.id);
      if (role === "A") {
        room.playerA.card = character;
        room.playerA.cardUid = cardUid;
        room.playerA.cardLevel = card.level;
        room.playerA.cardExp = card.exp;
        room.playerA.cardWins = card.totalWins;
        room.playerA.cardLosses = card.totalLosses;
        room.state.playerA = { card: character, hp: character.hp };
      } else if (role === "B" && room.playerB) {
        room.playerB.card = character;
        room.playerB.cardUid = cardUid;
        room.playerB.cardLevel = card.level;
        room.playerB.cardExp = card.exp;
        room.playerB.cardWins = card.totalWins;
        room.playerB.cardLosses = card.totalLosses;
        room.state.playerB = { card: character, hp: character.hp };
      }

      // 自分にカード情報 + role + level送信
      socket.emit("card_registered", { card: character, role: role!, level: card.level });

      // 相手にカード情報通知
      const opponentId =
        role === "A"
          ? room.playerB?.socketId
          : room.playerA.socketId;
      if (opponentId) {
        io.to(opponentId).emit("opponent_card_registered", {
          card: character,
          level: card.level,
        });
      }

      // 両者カード登録済み → バトル開始待機
      if (room.state.playerA && room.state.playerB) {
        room.state.status = "ready";
        tryStartBattle(io, room);
      }
    });

    // アクション選択
    socket.on("select_action", ({ action }) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room || room.state.status !== "battle") return;

      const role = roomManager.getPlayerRole(room, socket.id);
      if (!role) return;

      const turnType = room.state.turnType;
      const attackerRole = turnType === "A_attacks" ? "A" : "B";

      // アクションバリデーション
      if (role === attackerRole) {
        // 攻撃側: attack | special のみ
        if (action !== "attack" && action !== "special") return;
        // 必殺技クールダウンチェック
        if (action === "special") {
          const slot = role === "A" ? room.playerA : room.playerB;
          if (slot && slot.specialCd > 0) return;
        }
      } else {
        // 防御側: defend | counter のみ
        if (action !== "defend" && action !== "counter") return;
      }

      roomManager.setAction(room, role, action);

      // 両者選択完了 → ターン処理
      if (roomManager.bothActionsReady(room)) {
        processTurn(io, room);
      }
    });

    // ルーム離脱
    socket.on("leave_room", () => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (room) {
        const role = roomManager.getPlayerRole(room, socket.id);
        const opponentId =
          role === "A"
            ? room.playerB?.socketId
            : room.playerA.socketId;

        if (opponentId) {
          io.to(opponentId).emit("opponent_disconnected");
        }
        roomManager.removeRoom(room.code);
        console.log(`ルーム離脱: ${room.code} by ${socket.id}`);
      }
    });

    // 切断処理
    socket.on("disconnect", () => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (room) {
        const role = roomManager.getPlayerRole(room, socket.id);
        const opponentId =
          role === "A"
            ? room.playerB?.socketId
            : room.playerA.socketId;

        if (opponentId) {
          io.to(opponentId).emit("opponent_disconnected");
        }
        roomManager.removeRoom(room.code);
      }
      console.log(`切断: ${socket.id}`);
    });
  });
}
