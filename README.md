# LifeQuest

「頭でわかっていても、動けない」を終わらせる **タスク管理 × ファンタジーRPG** アプリ。
タスクを消化するたびに EXP・スキル・ステータスが伸び、スキル同士が融合して上位スキルへ進化する。
デザインシステムは **Extreme Action & Solid Pop**（斜め・ソリッド影・No Blur）。

## 公開URL（実機確認用）
https://mayotama106.github.io/lifequest/

## 構成
| ファイル | 内容 |
| :--- | :--- |
| `index.html` | アプリ本体（単一HTML / Pages公開対象） |
| `lifequest-design.md` | コア設計書（要件・画面・デザイン・データモデル・技術構成） |
| `lifequest-stories.md` | 実装ストーリー票（MVPバックログ） |
| `lifequest-design-expansion.md` | ガチャ・バトル拡張設計（サマナーズウォー型） |
| `lifequest-qa-checklist.md` | 手動QAチェックリスト |
| `lifequest-logic-tests.js` | ロジック回帰テスト（DOM非依存） |

## 実装状況（コア E1〜E6 完了）
- 永続化（localStorage `lifequest:v1`・壊れデータのフォールバック）
- クエストCRUD（追加/編集/削除・XSSエスケープ）
- 習慣クエストの日次リセット＋ストリーク
- EXP/レベル（`expForLevel` データ駆動）
- スキル獲得カットイン／融合（`FUSE_RECIPES` データ駆動・複数レシピ対応）

## 開発
```bash
# ロジック回帰テスト（期待: 25 passed, 0 failed）
node lifequest-logic-tests.js

# デプロイ（GitHub Pages: main ブランチ ルート）
git add -A && git commit -m "..." && git push
```
> `index.html` のロジックを変更したら `lifequest-logic-tests.js` のミラー実装も更新すること。

## 拡張方針（決定済み）
サマナーズウォー型のガチャ＆バトルを段階導入。クリスタルは**現実のタスク消化で稼ぐ**（課金なし）、
ガチャはお供キャラのみ、メインキャラ＝自分で**獲得スキルをアクティブ技として使用**。
詳細は `lifequest-design-expansion.md`。
