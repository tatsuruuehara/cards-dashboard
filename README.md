# CARDSダッシュボード

タスク管理・WBS・業務報告・オートメーションを統合したチーム向けダッシュボード。

## 構成

```
index.html              ← ダッシュボード本体（GitHub Pages で公開）
gas/
  apps-script-template.gs  ← Google Apps Script テンプレート（認証情報なし）
```

## セットアップ

### 1. Google スプレッドシートの準備

スプレッドシートに以下の列構成でシートを作成：

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| (空) | No. | 記載日 | カテゴリ | ステータス | タスク内容 | 詳細 | 期限日 | 実働時間h | 完了日 | 担当者 |

シートのGIDをURLから確認（`#gid=` の後の数字）。

### 2. Google Apps Script の設定

1. スプレッドシートのメニュー → 拡張機能 → Apps Script
2. `gas/apps-script-template.gs` の内容を貼り付け
3. 以下の値を書き換える：
   ```javascript
   const TASK_SHEET_GID = 0;               // ← シートGIDに変更
   const SLACK_WEBHOOK_URL = 'YOUR_...';    // ← Slack Webhook URL
   const SLACK_BOT_TOKEN   = 'YOUR_...';    // ← Slack Bot Token
   const SLACK_CHANNEL_ID  = 'YOUR_...';    // ← チャンネルID
   ```
4. デプロイ → 新しいデプロイ → 種類: **ウェブアプリ**
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員（匿名を含む）**
5. デプロイURLをコピー

### 3. index.html の GAS_URL を更新

`index.html` 内の以下の行を探して更新：
```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_DEPLOY_ID/exec';
```

### 4. GitHub Pages の有効化

1. このリポジトリの Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main** / **/ (root)**
4. Save → 数分後に `https://<user>.github.io/<repo>/` で公開

## 機能一覧

| タブ | 機能 |
|------|------|
| ダッシュボード | KPI集計・カテゴリ別進捗グラフ |
| WBS | ガントチャート・ECイベントカレンダー |
| 業務報告 | 日次業務サマリー生成・Slack投稿 |
| オートメーション | タスク自動生成テンプレート |
| 管理者 | カテゴリ管理・担当者管理 |

## 管理者ログイン

初期パスワード: `admin`（管理者タブから変更可能）

## 注意事項

- `gas/apps-script-template.gs` には認証情報を含めないこと
- 実際の認証情報は Google Apps Script エディタ内でのみ管理
