開発環境をトンネル付きでフルセットアップしてください。以下の手順を順番に実行します。

## 手順

### 1. 既存プロセスの確認・クリーンアップ

ポート3000, 8081を使用中のプロセスがあれば確認し、必要に応じて停止してください。
ngrokプロセスも確認してください。

### 2. Prisma Client 生成 + DB準備

```
cd apps/server && npx prisma generate && npx prisma db push
```

### 3. Next.js サーバ起動 (バックグラウンド)

```
pnpm dev:server
```

ポート3000で起動するのを確認してください。

### 4. ngrok トンネル起動 (バックグラウンド)

```
ngrok http 3000
```

起動後、ngrokが割り当てたPublic URLを取得してください。

### 5. Expo Metro バンドラ起動 (バックグラウンド)

```
cd apps/mobile && npx expo start --tunnel
```

### 6. 実機ビルド (Xcode)

iOSの実機（iPhone 15）でアプリを動かすため、以下を実行してください:

1. CocoaPods の依存関係をインストール:
```
cd apps/mobile/ios && pod install
```

2. Xcodeでワークスペースを開く:
```
open apps/mobile/ios/NFCCardBattle.xcworkspace
```

ユーザーにXcodeで以下を行うよう案内してください:
- デバイスセレクタで接続済みの **iPhone 15** を選択
- `Cmd + R` でビルド＆実行

### 7. Expo 接続URL取得・完了レポート

Expo Metro バンドラのトンネルURLを取得してください（Expoが使う ngrok は port 4041 で動作します）:

```
curl -s http://127.0.0.1:4041/api/tunnels | python3 -c "import sys,json; data=json.load(sys.stdin); [print(t['public_url']) for t in data['tunnels'] if t['public_url'].startswith('https')]"
```

すべて起動したら、以下の情報をまとめて報告してください:

- サーバ: http://localhost:3000
- ngrok URL: (取得したURL)
- 管理画面: (ngrok URL)/admin/cards
- Metro バンドラ: 起動状態
- **Expo 接続URL**: (取得したURL) ← 実機の「Enter URL manually」に入力

注意: ngrokの無料版ではAPIリクエストに `ngrok-skip-browser-warning: true` ヘッダーが必要です（アプリ側で対応済み）。
