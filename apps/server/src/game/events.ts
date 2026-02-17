import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Character,
  TurnType,
} from "@nfc-card-battle/shared";
import { TURN_TIME_LIMIT } from "@nfc-card-battle/shared";
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
function processTurn(io: IO, room: Room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }

  if (
    !room.state.playerA ||
    !room.state.playerB ||
    !room.playerB
  )
    return;

  const turnType = room.state.turnType;
  const attackerRole = turnType === "A_attacks" ? "A" : "B";

  const attackerSlot = attackerRole === "A" ? room.playerA : room.playerB;
  const defenderSlot = attackerRole === "A" ? room.playerB : room.playerA;
  const attackerState = attackerRole === "A" ? room.state.playerA : room.state.playerB;
  const defenderState = attackerRole === "A" ? room.state.playerB : room.state.playerA;

  if (!attackerSlot || !defenderSlot || !attackerState || !defenderState) return;

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

    const endData = { winner, finalState: room.state };
    io.to(room.playerA.socketId).emit("battle_end", endData);
    io.to(room.playerB.socketId).emit("battle_end", endData);

    roomManager.removeRoom(room.code);
  } else {
    // 次のターンへ
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
    socket.on("register_card", async ({ cardUid }) => {
      const room = roomManager.findRoomBySocket(socket.id);
      if (!room) {
        socket.emit("error", { message: "ルームに参加していません" });
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

      const character: Character = {
        id: card.character.id,
        name: card.character.name,
        hp: card.character.hp,
        attack: card.character.attack,
        defense: card.character.defense,
        imageUrl: card.character.imageUrl,
      };

      const role = roomManager.getPlayerRole(room, socket.id);
      if (role === "A") {
        room.playerA.card = character;
        room.state.playerA = { card: character, hp: character.hp };
      } else if (role === "B" && room.playerB) {
        room.playerB.card = character;
        room.state.playerB = { card: character, hp: character.hp };
      }

      // 自分にカード情報 + role送信
      socket.emit("card_registered", { card: character, role: role! });

      // 相手にカード情報通知
      const opponentId =
        role === "A"
          ? room.playerB?.socketId
          : room.playerA.socketId;
      if (opponentId) {
        io.to(opponentId).emit("opponent_card_registered", {
          card: character,
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
