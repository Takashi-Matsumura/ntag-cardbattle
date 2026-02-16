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
- StyleSheet と className を混在させない

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| モバイルアプリ | Expo + NativeWind + react-native-nfc-manager |
| バックエンド | Next.js (TypeScript) カスタムサーバ |
| リアルタイム通信 | Socket.io |
| データベース | PostgreSQL + Prisma |
| インフラ | Docker Compose |
