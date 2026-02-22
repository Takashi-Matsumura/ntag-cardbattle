# NTag Battle

物理NTAGカードをスマホで読み取り、カードに紐づいたキャラクターでリアルタイム対戦するカードバトルゲーム。

<p align="center">
  <img src="docs/screenshot-battle.png" alt="バトル画面" width="300" />
</p>

## 概要

- NTAGカードのUIDをiPhoneのNFCで読み取り
- 設定画面の「カード登録（ガチャ）」でランダムキャラクターを割り当て（サーバ不要）
- MultipeerConnectivity（Bluetooth/WiFi Direct）でP2Pローカル対戦

## 技術スタック

| レイヤー       | 技術                                                        |
| -------------- | ----------------------------------------------------------- |
| モバイルアプリ | Expo (React Native) + NativeWind + react-native-nfc-manager |
| 管理画面       | Next.js (TypeScript) + Tailwind CSS                         |
| データベース   | SQLite + Prisma ORM                                         |
| ローカルデータ | AsyncStorage（カードデータ・アプリ設定）                    |
| P2P通信        | MultipeerConnectivity（Bluetooth/WiFi Direct）              |

## プロジェクト構成

```
nfc-card-battle/
├── apps/
│   ├── server/          # Next.js + Prisma + SQLite（管理画面・シミュレータ）
│   │   ├── src/
│   │   │   ├── app/     # Next.js App Router (API + 管理画面)
│   │   │   └── game/    # バトルエンジン・シミュレータ
│   │   └── prisma/      # スキーマ・シード
│   └── mobile/          # Expo アプリ
│       ├── app/         # expo-router 画面
│       │   ├── (tabs)/  # ホーム・設定
│       │   └── battle/  # バトル画面・チュートリアル・P2P対戦
│       ├── components/  # BattleCard・HpBar 等の共通コンポーネント
│       ├── lib/         # NFC・P2Pトランスポート・ローカルカード管理
│       └── modules/     # MultipeerConnectivity Expoモジュール
└── packages/
    └── shared/          # 共有型定義・定数・バトルエンジン
```

## セットアップ

### 必要なもの

- Node.js 18+
- pnpm 9+
- Xcode (iOS実機ビルド用)
- NTAGカード (NFC対応のもの)

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. データベースの初期化

```bash
# SQLiteにスキーマ反映
pnpm db:push

# 初期キャラクターデータ投入
pnpm db:seed
```

### 3. サーバ起動

```bash
pnpm dev:server
# http://localhost:3000 で起動
# 管理画面: http://localhost:3000/admin/cards
```

### 4. モバイルアプリ起動

```bash
pnpm dev:mobile
```

iOS実機で動かす場合:

```bash
cd apps/mobile
npx expo prebuild --platform ios
# Xcode で apps/mobile/ios/*.xcworkspace を開いてビルド
```

## 遊び方

### カードの準備

1. 設定画面の「カード登録（ガチャ）」をタップ
2. NTAGカードをスキャン → ランダムキャラクターが割り当てられる
3. 登録済みカード一覧でキャラ名・レベル・ステータスを確認

### チュートリアル (CPU対戦)

1. ホーム画面の「チュートリアル」をタップ
2. NFCカードをスキャン（または「カードなしで体験」でデモモード）
3. CPUにはランダムでキャラクターが割り当てられる
4. ターン制バトル開始

### P2Pローカル対戦

1. ホーム画面の「ローカル対戦」をタップ
2. 「ホストとして始める」or「相手を探す」を選択
3. MultipeerConnectivityでピア検出 → 自動接続
4. NFCカードをスキャン → バトル開始

## バトルシステム

ターン制で「攻撃ターン」と「防御ターン」が交互に切り替わります。

| ターン     | 選択肢     | 効果                                                      |
| ---------- | ---------- | --------------------------------------------------------- |
| 攻撃ターン | 攻撃       | 攻撃力 - 相手防御力 のダメージ                            |
|            | 必殺技     | 攻撃力 x1.8 の大ダメージ (使用後3ターンクールダウン)      |
| 防御ターン | 防御       | ダメージ軽減 (防御力 x1.5 で計算)                         |
|            | カウンター | 成功率30%で 攻撃力 x1.5 の反撃、失敗すると軽減なしで被弾 |

### キャラクター一覧

| 名前       | HP  | 攻撃 | 防御 | 特徴       |
| ---------- | --- | ---- | ---- | ---------- |
| ドラゴン   | 105 | 30   | 15   | バランス型 |
| ナイト     | 100 | 25   | 30   | 防御型     |
| ウィザード | 80  | 45   | 10   | 攻撃特化   |
| ゴーレム   | 150 | 20   | 35   | 耐久型     |
| アサシン   | 80  | 50   | 5    | 超攻撃型   |
| プリースト | 90  | 25   | 25   | 堅実型     |

## API

| エンドポイント        | メソッド | 説明                       |
| --------------------- | -------- | -------------------------- |
| `/api/characters`     | GET      | キャラクター一覧           |
| `/api/characters`     | POST     | キャラクター作成           |
| `/api/characters/:id` | PATCH    | キャラクター更新           |
| `/api/characters/:id` | DELETE   | キャラクター削除           |
| `/api/simulator`      | POST     | バトルシミュレーション実行 |

## 開発コマンド一覧

```bash
pnpm install            # 依存関係インストール
pnpm dev:server         # サーバ起動
pnpm dev:mobile         # Expo アプリ起動
pnpm db:push            # スキーマを DB に反映
pnpm db:seed            # シードデータ投入
pnpm db:studio          # Prisma Studio 起動
pnpm build:server       # サーバビルド
```

## アップデートログ

### 2026-02-22: リファクタリング・セキュリティ強化

- **サーバ簡素化**: カスタムHTTPサーバ（`server.ts`）を削除し、標準 `next dev` / `next start` に移行
- **デッドコード削除**: オンラインモード・サーバ同期の名残コード（`Card` 型、`cacheCardFromServer`、`tookDamageFromResult`）を除去
- **シミュレータUIバグ修正**: 防御倍率のデフォルト値が共有定数（1.5）と不一致だった問題を修正
- **APIセキュリティ強化**: 全APIエンドポイントに入力バリデーション・エラーハンドリングを追加（不正JSON→400、レコード不在→404、unique制約違反→409）
- **不要ファイル削除**: `.env.example`（SQLite移行により不要）、未使用 `expo-secure-store` プラグイン参照
- **ドキュメント更新**: README・開発コマンドを現状のアーキテクチャに合わせて全面改訂

### 2026-02-19: バトルUI改善・スワイプ操作カード導入

- バトル中の自分カードにスワイプ操作UIを導入
  - カードを左右にスワイプして「攻撃/必殺技」「防御/カウンター」を選択
  - スワイプ後にタップで確定する2段階操作で誤操作を防止
  - カード回転アニメーション付きでアクション内容を横向き表示
- 自分カードと相手カードのアスペクト比を統一
- 防御ターン時のアクションカードにHP詳細表示を追加

### 2026-02-18: バトルシミュレーター追加・バランス調整

- 管理画面にバトルシミュレーター (`/admin/simulator`) を追加
  - 全マッチアップ（N×N）×任意回数の自動対戦シミュレーション
  - 勝率ヒートマップ・キャラ別ランキング・膠着マッチアップ一覧
  - バトルパラメータ（防御倍率・必殺倍率・カウンター成功率等）をリアルタイム変更して再実行可能
  - キャラクターステータスの仮変更（DB未反映）で影響をプレビュー
- シミュレーション結果に基づきバランス調整を実施
  - 防御倍率を 2.0 → 1.5 に変更（通常攻撃の0ダメージ問題を解消）
  - ドラゴン: HP 120→105, ATK 35→30（1強状態を解消）
  - アサシン: HP 70→80（ガラスキャノンすぎる問題を緩和）
  - プリースト: ATK 15→25（勝率14%→46%に改善）
  - 調整後、全キャラの総合勝率が46〜63%の範囲に収束

## 音源素材のセットアップ

バトル中のBGM・効果音にフリー素材を使用しています。利用規約により素材ファイルはリポジトリに含まれていないため、各自でダウンロードして配置してください。

### ダウンロード元

| ファイル名 | 用途 | ダウンロード元 |
|-----------|------|---------------|
| `bgm-battle.mp3` | バトルBGM（ループ） | [魔王魂](https://maou.audio/) |
| `se-attack.mp3` | 通常攻撃ヒット | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-special.mp3` | 必殺技ヒット | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-defense.mp3` | 防御（ブロック） | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-counter-ok.mp3` | カウンター成功 | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-counter-fail.mp3` | カウンター失敗 | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-damage.mp3` | 被ダメージ | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-victory.mp3` | 勝利ファンファーレ | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-defeat.mp3` | 敗北 | [効果音ラボ](https://soundeffect-lab.info/) |
| `se-turn.mp3` | ターン開始 | [効果音ラボ](https://soundeffect-lab.info/) |

### 配置先

ダウンロードした素材を以下のディレクトリに配置してください。

```
apps/mobile/assets/sounds/
├── bgm-battle.mp3
├── se-attack.mp3
├── se-special.mp3
├── se-defense.mp3
├── se-counter-ok.mp3
├── se-counter-fail.mp3
├── se-damage.mp3
├── se-victory.mp3
├── se-defeat.mp3
└── se-turn.mp3
```

音源ファイルがなくてもアプリは動作しますが、バトル中の効果音・BGMが再生されません。

## クレジット・謝辞

本プロジェクトのバトル演出は、素晴らしいフリー素材を提供してくださっている以下のサイトのおかげで成り立っています。

- **[魔王魂](https://maou.audio/)** — バトルBGM
  - 高品質なゲーム向けBGMを無料で提供されています。ありがとうございます。
- **[効果音ラボ](https://soundeffect-lab.info/)** — バトル効果音（攻撃・防御・必殺技・カウンター・勝敗等）
  - 豊富なカテゴリの効果音を無料で提供されています。ありがとうございます。

各素材の利用にあたっては、それぞれのサイトの利用規約に従ってください。素材ファイルの再配布は禁止されています。

## ライセンス

MIT
