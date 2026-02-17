開発環境をトンネル付きでフルセットアップしてください。以下の手順を順番に実行します。

## 手順

### 1. 既存プロセスの確認・クリーンアップ

ポート3000, 8081を使用中のプロセスがあれば確認し、必要に応じて停止してください。
ngrokプロセスも確認してください。

### 2. Docker (PostgreSQL) 起動

```
pnpm docker:up
```

起動を確認してください。

### 3. Prisma Client 生成

```
cd apps/server && npx prisma generate
```

### 4. Next.js + Socket.io サーバ起動 (バックグラウンド)

```
pnpm dev:server
```

ポート3000で起動するのを確認してください。

### 5. ngrok トンネル起動 (バックグラウンド)

```
ngrok http 3000
```

起動後、ngrokが割り当てたPublic URLを取得してください。

### 6. モバイルアプリの .env 更新

`apps/mobile/.env` の `EXPO_PUBLIC_SERVER_URL` を、ngrokで取得したURLに更新してください。

### 7. Expo Metro バンドラ起動 (バックグラウンド)

```
cd apps/mobile && npx expo start --tunnel
```

### 8. 完了レポート

すべて起動したら、以下の情報をまとめて報告してください:

- PostgreSQL: 起動状態
- サーバ: http://localhost:3000
- ngrok URL: (取得したURL)
- 管理画面: (ngrok URL)/admin/cards
- Metro バンドラ: 起動状態
- `apps/mobile/.env` に設定したURL

注意: ngrokの無料版ではAPIリクエストに `ngrok-skip-browser-warning: true` ヘッダーが必要です（アプリ側で対応済み）。
