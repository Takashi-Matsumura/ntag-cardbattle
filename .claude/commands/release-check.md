リリース前の整合性チェックを実行してください。以下の手順をすべて実行し、最後に結果をまとめて報告します。

## 手順

### 1. TypeScript型チェック

各パッケージで型チェックを実行してください:

```
cd packages/shared && npx tsc --noEmit
cd apps/server && npx tsc --noEmit
cd apps/mobile && npx tsc --noEmit
```

エラーがあれば記録してください。

### 2. CHARACTERS ↔ SQLite 整合性チェック

`packages/shared/src/characters.ts` の `CHARACTERS` 配列をDBに同期し、整合性を確認してください:

```
pnpm db:seed
```

確認ポイント:
- seedが正常に完了するか
- `CHARACTERS` 配列のキャラクター数とDB上のレコード数が一致するか

### 3. シミュレータでバランスチェック

```
pnpm dev:server
```

サーバを起動し、http://localhost:3000/admin/simulator で全マッチアップの勝率を確認してください。

確認ポイント:
- 極端な偏り（勝率 **20%以下** or **80%以上**）のマッチアップがないか
- 全キャラの総合勝率が **40〜60%** の範囲か
- 膠着マッチアップ（平均ターン数が極端に多い）がないか

### 4. README.md の整合性

`README.md` のキャラクター一覧テーブルと `packages/shared/src/characters.ts` の `CHARACTERS` 配列を比較してください:

- キャラクター名が一致するか
- ステータス値（HP / ATK / DEF）が一致するか
- キャラクター数が一致するか

### 5. CLAUDE.md の整合性

`CLAUDE.md` の情報が最新か確認してください:

- キャラクター数の記載（例: 「6キャラ」）が実際と一致するか
- バトルパラメータ値の記載が `constants.ts` と一致するか
- ファイルパスの記載が実在するか

### 6. 完了レポート

すべてのチェック結果をまとめて報告してください:

| チェック項目 | 結果 | 詳細 |
|------------|------|------|
| TypeScript型チェック (shared) | OK / NG | エラー内容 |
| TypeScript型チェック (server) | OK / NG | エラー内容 |
| TypeScript型チェック (mobile) | OK / NG | エラー内容 |
| CHARACTERS ↔ SQLite 整合性 | OK / NG | 差分内容 |
| シミュレータ バランス | OK / 要確認 | 偏りのあるマッチアップ |
| README.md 整合性 | OK / NG | 不一致箇所 |
| CLAUDE.md 整合性 | OK / NG | 不一致箇所 |

**総合判定**: リリース可能 / 要修正

要修正の場合は、修正が必要な項目と対応方法を具体的に提示してください。
