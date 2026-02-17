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

### 7. 実機iPhoneにビルド＆インストール

NFC機能を使うため、実機iPhoneへのビルドが必要です。

まず、接続されているデバイスを確認してください:

```
xcrun xctrace list devices 2>&1 | head -5
```

ユーザーに以下のデバイスからどちらにビルドするか選択してもらってください:

- **iPhone15 mats** — UDID: 00008120-000C2D0E1EF1A01E
- **iPhone SE2** — UDID: 00008030-001155AA2246402E

選択されたデバイスのUDIDを使って、実機ビルドを実行してください:

```
cd apps/mobile && npx expo run:ios --device "<選択されたUDID>"
```

このコマンドはビルドに数分かかります。タイムアウトを長め（600秒）に設定してください。
ビルド完了後、アプリが実機に自動インストールされて起動します。

### 8. 完了レポート

すべて起動したら、以下の情報をまとめて報告してください:

- PostgreSQL: 起動状態
- サーバ: http://localhost:3000
- ローカルIP: (取得したIP)
- サーバURL: http://<ローカルIP>:3000
- 管理画面: http://<ローカルIP>:3000/admin/cards
- 実機ビルド: ビルド先デバイス名
- `apps/mobile/.env` に設定したURL
