# NFC Card Battle

NTAGを使ったカードバトルゲーム。物理NTAGカードのUIDをスマホで読み取り、ローカル対戦（P2P）でリアルタイム対戦する。カードへのキャラ登録は設定画面の「ガチャ」で行う（サーバ不要）。

## プロジェクト構成

pnpm workspaces モノレポ:

- `apps/server` — Next.js（管理画面・バトルシミュレータ）+ Prisma + SQLite
- `apps/mobile` — Expo (React Native) + NativeWind
- `packages/shared` — 共有型定義・定数・バトルエンジン

## コマンド

```bash
# 開発
pnpm install                  # 依存関係インストール
pnpm db:push                  # SQLiteにスキーマ反映（初回・スキーマ変更時）
pnpm db:seed                  # シードデータ投入
pnpm dev:server               # サーバ起動 (http://localhost:3000)
pnpm dev:mobile               # Expoアプリ起動

# データベース
pnpm db:studio                # Prisma Studio起動
```

## 開発ルール

- UI・コメント・ドキュメントはすべて日本語
- モバイルアプリは NativeWind（className）でスタイリング
- 管理画面（Next.js）は Tailwind CSS でスタイリング
- StyleSheet と className を混在させない（ただしネイティブコンポーネント等は `style` プロップを使用）
- `.npmrc` で `node-linker=hoisted` を使用（Expo/Metro互換のため）

## カスタムコマンド

- `/dev-wifi` — 開発環境フルセットアップ（サーバ + Metro + 実機ビルド）
- `/dev-tunnel` — 開発環境フルセットアップ（サーバ + ngrokトンネル + Metro）
- `/close-dev` — 開発環境の全プロセス停止（Metro → ngrok → サーバ）

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| モバイルアプリ | Expo + NativeWind + react-native-nfc-manager |
| 管理画面 | Next.js (TypeScript) + Tailwind CSS |
| データベース | SQLite + Prisma |
| ローカルデータ | AsyncStorage（カードデータ・アプリ設定） |
| P2P通信 | MultipeerConnectivity（Bluetooth/WiFi Direct） |

## バトルシステム

ターン制バトル。プレイヤーA（ホスト）が先攻で、攻撃/防御ターンを交互に繰り返す。

- **攻撃ターン**: 攻撃 / 必殺技（CT: 3ターン、倍率1.8x）
- **防御ターン**: 防御（防御力2倍） / カウンター（成功率30%、成功時1.5xダメージ反撃、失敗時防御力無視）
- **タイムアウト**: 攻撃側→ペナルティ（防御側が反撃）、防御側→ノーガード（防御力無視フルダメージ）
- **勝敗**: ホスト側エンジンが判定し、両者に結果を送信

### 経験値・レベルシステム

- **レベル**: 最大Lv20、累積EXPで算出（Lv N到達 = N² × 10 EXP）
- **ステータス補正**: レベルごとに+2%（倍率 = 1 + (Lv-1) × 0.02）
- **EXP獲得**: 勝利30 / 敗北10をベースに、相手との戦力差で変動（最低5、最大50）
- **バトル終了画面**: EXPバー・レベルアップ表示・NFC書き込みUI

### NFC書き込み

- バトル終了後、勝敗に関わらずカードへ記念データ書き込み（任意）
- `apps/mobile/lib/nfc.ts` の `writeNfcData()` で実装

### カード登録（ガチャ）

- 設定画面の「カード登録（ガチャ）」でNTAGスキャン → ランダムキャラ割り当て（サーバ不要）
- 登録済みカード一覧表示（キャラ名・レベル・ステータス・戦績・EXPバー）
- 「リセット」ボタンで再ガチャ可能（確認ダイアログ付き、Lv1・戦績初期化）
- P2Pバトルでは事前登録済みカードのみ使用可能（未登録時はエラー表示）

### P2Pローカル対戦

サーバ不要の近距離対戦モード。MultipeerConnectivity（Bluetooth/WiFi Direct）を使用。

```
Device A (Host/エンジン) ←→ MultipeerConnectivity ←→ Device B (Guest)
```

- **ホスト**: Player Aとして行動 + `resolveTurnBased()` 実行 + EXP計算
- **ゲスト**: Player Bとして行動 + 結果受信
- **データ**: AsyncStorageにローカル保存
- **トランスポート抽象化**: `BattleTransport` インターフェースでP2Pトランスポートを実装

**P2Pマッチングフロー**:
1. 「ローカル対戦」タップ → `local.tsx` へ遷移
2. 「ホストとして始める」or「相手を探す」選択
3. MultipeerConnectivity でピア検出 → 自動接続
4. 両者接続完了 → `p2p.tsx` へ遷移（role=host/guest）
5. NFCカードスキャン → ローカルデータ使用 → バトル開始

### チュートリアル デモモード

- scanフェーズに「カードなしで体験」ボタンを表示（NFCスキャンボタンの下）
- NFCカード・ローカルカードを経由せず、ランダムキャラでバトル体験可能
- App Store審査対応：審査員がNTAGカードなしでもアプリを体験できる

## 開発環境の構成

- SQLite: `apps/server/prisma/dev.db`（Docker不要）
- Next.js: port 3000（管理画面・シミュレータ）
- Expo Metro: port 8081

## ファイル構成の要点

### サーバ側（管理画面・シミュレータ）
- `apps/server/src/server.ts` — カスタムHTTPサーバ（Next.js）
- `apps/server/src/game/engine.ts` — shared/engine.tsのre-export
- `apps/server/src/game/simulator.ts` — バトルシミュレーション（ゲームバランス分析）
- `apps/server/src/app/admin/cards/` — キャラクター管理画面
- `apps/server/src/app/admin/simulator/` — バトルシミュレータ画面

### モバイルアプリ
- `apps/mobile/app/battle/tutorial.tsx` — チュートリアルバトル（ローカルカード使用 / デモモード: NFCスキャン不要）
- `apps/mobile/app/battle/local.tsx` — P2Pマッチング画面（ホスト/ゲスト選択→ピア検出）
- `apps/mobile/app/battle/p2p.tsx` — P2Pバトル画面（MultipeerConnectivity）
- `apps/mobile/components/BattleCard.tsx` — バトルカードコンポーネント
- `apps/mobile/components/HpBar.tsx` — HPバーコンポーネント
- `apps/mobile/lib/nfc.ts` — NFC読み取り・書き込みユーティリティ
- `apps/mobile/app/(tabs)/settings.tsx` — 設定タブ画面（カードガチャ）
- `apps/mobile/lib/settings.ts` — アプリ設定の永続化（AsyncStorage）
- `apps/mobile/lib/battle-transport.ts` — BattleTransportインターフェース（P2P用）
- `apps/mobile/lib/p2p-protocol.ts` — P2Pメッセージ型定義
- `apps/mobile/lib/p2p-host-transport.ts` — ホスト側P2Pトランスポート（エンジン実行）
- `apps/mobile/lib/p2p-guest-transport.ts` — ゲスト側P2Pトランスポート（結果受信のみ）
- `apps/mobile/lib/local-cards.ts` — AsyncStorageによるローカルカードデータ管理
- `apps/mobile/hooks/useBattle.ts` — バトル状態管理フック（トランスポート非依存）
- `apps/mobile/modules/multipeer-connectivity/` — iOS MultipeerConnectivity Expoモジュール

### 共有パッケージ
- `packages/shared/src/types.ts` — 共有型定義（TurnResult, TurnType等）
- `packages/shared/src/constants.ts` — 共有定数（バトルパラメータ・経験値・レベル）
- `packages/shared/src/damage.ts` — ダメージ変動計算
- `packages/shared/src/level.ts` — レベル・経験値計算（EXP算出・ステータス補正）
- `packages/shared/src/image.ts` — キャラクター画像URL生成
- `packages/shared/src/engine.ts` — ターン制ダメージ計算エンジン（resolveTurnBased）
- `packages/shared/src/characters.ts` — 6キャラのベースデータ定義
