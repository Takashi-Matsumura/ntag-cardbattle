開発環境をローカルWiFiモードでフルセットアップしてください。ngrokは使いません。以下の手順を順番に実行します。

## 手順

### 1. 既存プロセスの確認・クリーンアップ

ポート3000, 8081を使用中のプロセスがあれば確認し、必要に応じて停止してください。

### 2. ローカルIPアドレスの取得

WiFiインターフェース（en0）のIPアドレスを取得してください。

```
ipconfig getifaddr en0
```

### 3. Docker (PostgreSQL) 起動

```
pnpm docker:up
```

起動を確認してください。

### 4. Prisma Client 生成

```
cd apps/server && npx prisma generate
```

### 5. Next.js + Socket.io サーバ起動 (バックグラウンド)

```
pnpm dev:server
```

ポート3000で起動するのを確認してください。

### 6. モバイルアプリの .env 更新

`apps/mobile/.env` の `EXPO_PUBLIC_SERVER_URL` を、取得したローカルIPアドレスを使って `http://<ローカルIP>:3000` に更新してください。

### 7. Expo Metro バンドラ起動 (バックグラウンド)

```
cd apps/mobile && npx expo start --lan
```

### 8. 完了レポート

すべて起動したら、以下の情報をまとめて報告してください:

- PostgreSQL: 起動状態
- サーバ: http://localhost:3000
- ローカルIP: (取得したIP)
- サーバURL: http://<ローカルIP>:3000
- 管理画面: http://<ローカルIP>:3000/admin/cards
- Metro バンドラ: 起動状態（LANモード）
- `apps/mobile/.env` に設定したURL
