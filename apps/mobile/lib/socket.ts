import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@nfc-card-battle/shared";

// 開発時はローカルサーバに接続
const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000";

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  SERVER_URL,
  {
    autoConnect: false,
    transports: ["websocket"],
  }
);
