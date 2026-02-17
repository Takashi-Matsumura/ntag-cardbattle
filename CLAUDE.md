# NFC Card Battle

NTAGを使ったカードバトルゲーム。物理NTAGカードのUIDをスマホで読み取り、サーバ管理のキャラクターデータでリアルタイム対戦する。

## プロジェクト構成

pnpm workspaces モノレポ:

- `apps/server` — Next.js カスタムサーバ + Socket.io + Prisma
- `apps/mobile` — Expo (React Native) + NativeWind
- `packages/shared` — 共有型定義・定数

## コマンド

```bash
# 開発
pnpm install                  # 依存関係インストール
pnpm docker:up                # PostgreSQL起動
pnpm db:migrate               # マイグレーション実行
pnpm db:seed                  # シードデータ投入
pnpm dev:server               # サーバ起動 (http://localhost:3000)
pnpm dev:mobile               # Expoアプリ起動

# データベース
pnpm db:push                  # スキーマをDBに反映（開発用）
pnpm db:studio                # Prisma Studio起動
```

## 開発ルール

- UI・コメント・ドキュメントはすべて日本語
- モバイルアプリは NativeWind（className）でスタイリング
- 管理画面（Next.js）は Tailwind CSS でスタイリング
- StyleSheet と className を混在させない（ただしネイティブコンポーネント（CameraView等）は `style` プロップを使用）
- `.npmrc` で `node-linker=hoisted` を使用（Expo/Metro互換のため）
- ngrokの無料版ではAPIに `ngrok-skip-browser-warning: true` ヘッダーが必要（モバイルアプリ側で対応済み）

## カスタムコマンド

- `/dev-tunnel` — 開発環境フルセットアップ（Docker + サーバ + ngrokトンネル + Metro）
- `/close-dev` — 開発環境の全プロセス停止（Metro → ngrok → サーバ → Docker）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| モバイルアプリ | Expo + NativeWind + react-native-nfc-manager |
| バックエンド | Next.js (TypeScript) カスタムサーバ |
| リアルタイム通信 | Socket.io |
| データベース | PostgreSQL + Prisma |
| インフラ | Docker Compose |

## バトルシステム

ターン制バトル。プレイヤーA（ルーム作成者）が先攻で、攻撃/防御ターンを交互に繰り返す。

- **攻撃ターン**: 攻撃 / 必殺技（CT: 3ターン、倍率1.8x）
- **防御ターン**: 防御（防御力2倍） / カウンター（成功率30%、成功時1.5xダメージ反撃、失敗時防御力無視）
- **タイムアウト**: 攻撃側→ペナルティ（防御側が反撃）、防御側→ノーガード（防御力無視フルダメージ）
- **勝敗**: サーバーが `role` ("A"/"B") を各プレイヤーに送信し、`winner === myRole` で正しく判定

### マッチングフロー

1. 「対戦」ボタン → ルーム自動作成 + QRコード表示
2. 同画面から「相手のQRを読み取る」→ カメラ（スキャンフレーム付き）
3. QR読み取り → ルーム参加 → バトル画面遷移
4. NFCカードスキャン → 両者完了でバトル開始
5. scan/waitingフェーズでキャンセル可能（`leave_room` イベント）

## 開発環境の構成

テザリング環境などローカルネットワークが使えない場合、ngrokトンネルを使用する:

- PostgreSQL: Docker (port 5432)
- Next.js + Socket.io: port 3000
- ngrok: port 3000 → public URL (apps/mobile/.env に設定)
- Expo Metro: port 8081 (--tunnel モード)

## ファイル構成の要点

- `apps/server/src/server.ts` — カスタムHTTPサーバ（Next.js + Socket.io統合）
- `apps/server/src/game/engine.ts` — ターン制ダメージ計算エンジン（必殺技・カウンター対応）
- `apps/server/src/game/room-manager.ts` — ルーム管理（ターン状態・クールダウン管理）
- `apps/server/src/game/events.ts` — Socket.ioイベントハンドラ（ターン制フロー）
- `apps/mobile/app/battle/tutorial.tsx` — チュートリアルバトル（ローカル処理）
- `apps/mobile/app/battle/[roomId].tsx` — 対人バトル（ターン制・Socket.io）
- `apps/mobile/components/BattleCard.tsx` — バトルカードコンポーネント
- `apps/mobile/components/HpBar.tsx` — HPバーコンポーネント
- `apps/mobile/lib/nfc.ts` — NFC読み取りユーティリティ
- `apps/mobile/lib/socket.ts` — Socket.ioクライアント
- `packages/shared/src/types.ts` — 共有型定義（TurnResult, TurnType等）
- `packages/shared/src/constants.ts` — 共有定数（バトルパラメータ）
- `packages/shared/src/damage.ts` — ダメージ変動計算
- `packages/shared/src/image.ts` — キャラクター画像URL生成
