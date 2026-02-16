import type { Server, Socket } from "socket.io";
import type {
  ActionType,
  ClientToServerEvents,
  ServerToClientEvents,
  Character,
} from "@nfc-card-battle/shared";
import { TURN_TIME_LIMIT } from "@nfc-card-battle/shared";
import { roomManager, type Room } from "./room-manager";
import { resolveTurn } from "./engine";
import { prisma } from "../lib/prisma";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ランダムアクション（タイムアウト時）
function randomAction(): ActionType {
  return Math.random() < 0.5 ? "attack" : "defend";
}

// ターン開始
function startTurn(io: IO, room: Room) {
  room.state.currentTurn++;
  roomManager.resetActions(room);

  // 両者にターン開始を通知
  const turnData = {
    turn: room.state.currentTurn,
    timeLimit: TURN_TIME_LIMIT,
  };
  io.to(room.playerA.socketId).emit("battle_start", turnData);
  if (room.playerB) {
    io.to(room.playerB.socketId).emit("battle_start", turnData);
  }

  // タイムアウト処理
  room.turnTimer = setTimeout(() => {
    // 未選択のプレイヤーにはランダムアクション
    if (room.playerA.action === null) {
      room.playerA.action = randomAction();
    }
    if (room.playerB && room.playerB.action === null) {
      room.playerB.action = randomAction();
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

  const result = resolveTurn(
    room.state.currentTurn,
    {
      hp: room.state.playerA.hp,
      attack: room.state.playerA.card.attack,
      defense: room.state.playerA.card.defense,
    },
    {
      hp: room.state.playerB.hp,
      attack: room.state.playerB.card.attack,
      defense: room.state.playerB.card.defense,
    },
    room.playerA.action!,
    room.playerB.action!
  );

  // HP更新
  room.state.playerA.hp = result.playerA.hpAfter;
  room.state.playerB.hp = result.playerB.hpAfter;

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
      // 同時KOの場合、HPが多い方が勝ち（同じならA勝利）
      winner = "A";
    } else {
      winner = aAlive ? "A" : "B";
    }

    const endData = { winner, finalState: room.state };
    io.to(room.playerA.socketId).emit("battle_end", endData);
    io.to(room.playerB.socketId).emit("battle_end", endData);

    // ルーム削除
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

      // 自分にカード情報送信
      socket.emit("card_registered", { card: character });

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

      roomManager.setAction(room, role, action);

      // 両者選択完了 → ターン処理
      if (roomManager.bothActionsReady(room)) {
        processTurn(io, room);
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
