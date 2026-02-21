import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@nfc-card-battle/shared";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

// 現在のSocketインスタンスを取得（未接続時はnull）
export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
  return socket;
}

// 指定URLでSocket接続を作成・開始
export function connectSocket(serverUrl: string): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket) {
    socket.disconnect();
  }
  socket = io(serverUrl, {
    autoConnect: false,
    transports: ["websocket"],
  });
  socket.connect();
  return socket;
}

// Socket接続を切断
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
