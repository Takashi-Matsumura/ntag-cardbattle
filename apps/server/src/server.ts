import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@nfc-card-battle/shared";
import { setupSocketHandlers } from "./game/events";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: { origin: "*" },
  });

  // Socket.io イベントハンドラを登録
  setupSocketHandlers(io);

  server.listen(port, () => {
    console.log(`> サーバ起動: http://${hostname}:${port}`);
    console.log(`> モード: ${dev ? "開発" : "本番"}`);
  });
});
