/**
 * タスク管理ダッシュボード GAS スクリプト
 *
 * 設定手順:
 * 1. スプレッドシートのメニュー → 拡張機能 → Apps Script
 * 2. このスクリプト全体を貼り付けて保存
 * 3. 下記の「要設定」項目を自分の値に書き換える
 * 4. デプロイ → 新しいデプロイ → 種類: ウェブアプリ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員（匿名を含む）
 * 5. デプロイURLを index.html の GAS_URL に貼り付ける
 */

// ── 要設定 ──────────────────────────────────────
// タスクシートのGID（スプレッドシートURLの #gid= の値）
const TASK_SHEET_GID = 0; // ← 自分のシートGIDに変更

// Slack Incoming Webhook URL
// https://api.slack.com/apps → Incoming Webhooks から取得
const SLACK_WEBHOOK_URL = 'YOUR_SLACK_WEBHOOK_URL';

// Slack Bot Token（xoxb-...）
// https://api.slack.com/apps → OAuth & Permissions から取得
const SLACK_BOT_TOKEN = 'YOUR_SLACK_BOT_TOKEN';

// 業務報告を投稿するSlackチャンネルID
const SLACK_CHANNEL_ID = 'YOUR_SLACK_CHANNEL_ID';

// 業務報告時のメンション（@here / @channel / @グループ名 / 空文字で無効）
const SLACK_MENTION = '@here';
// ────────────────────────────────────────────────

// シート列定義（1始まり）
// A=1(空), B=2(No.), C=3(記載日), D=4(カテゴリ), E=5(ステータス),
// F=6(タスク内容), G=7(詳細), H=8(期限日), I=9(実働時間h), J=10(完了日), K=11(担当者)
const COL = {
  NO:         2,
  ENTRY_DATE: 3,
  CATEGORY:   4,
  STATUS:     5,
  TASK_NAME:  6,
  DETAIL:     7,
  DUE_DATE:   8,
  WORK_HOURS: 9,
  COMPLETED:  10,
  ASSIGNEE:   11,
};

function getSheetByGid(gid) {
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const sheet  = sheets.find(s => s.getSheetId() === Number(gid));
  if (!sheet) throw new Error('GID ' + gid + ' のシートが見つかりません');
  return sheet;
}

function doGet(e) {
  const action   = e.parameter.action   || '';
  const callback = e.parameter.callback || '';
  let result;
  try {
    if (action === 'add') {
      result = addTask(JSON.parse(e.parameter.data || '{}'));
    } else if (action === 'edit') {
      result = editTask(JSON.parse(e.parameter.data || '{}'));
    } else if (action === 'delete') {
      result = deleteTask(JSON.parse(e.parameter.data || '{}'));
    } else if (action === 'postSlack') {
      const data = JSON.parse(e.parameter.data || '{}');
      result = postToSlack(data.text, data.thread_ts);
    } else if (action === 'findThread') {
      return findSlackThread(e);
    } else {
      result = { status: 'error', message: '不明なアクション: ' + action };
    }
  } catch(err) {
    result = { status: 'error', message: err.message };
  }
  return jsonpResponse(result, callback);
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch(_) {
    try { data = JSON.parse(e.parameter.data); } catch(__) { data = {}; }
  }
  let result;
  try {
    if (data.action === 'add')       result = addTask(data);
    else if (data.action === 'edit') result = editTask(data);
    else throw new Error('不明なアクション');
  } catch(err) {
    result = { status: 'error', message: err.message };
  }
  return jsonpResponse(result, '');
}

function addTask(data) {
  const sheet  = getSheetByGid(TASK_SHEET_GID);
  const nextNo = getLastNo(sheet) + 1;
  sheet.appendRow(buildRow(nextNo, data));
  return { status: 'ok', no: nextNo };
}

function deleteTask(data) {
  const sheet  = getSheetByGid(TASK_SHEET_GID);
  const taskNo = Number(data.taskNo);
  if (!taskNo) throw new Error('taskNo が指定されていません');
  const lastRow = sheet.getLastRow();
  for (let r = 2; r <= lastRow; r++) {
    if (Number(sheet.getRange(r, COL.NO).getValue()) === taskNo) {
      sheet.deleteRow(r);
      return { status: 'ok', no: taskNo };
    }
  }
  throw new Error('No.' + taskNo + ' の行が見つかりません');
}

function editTask(data) {
  const sheet  = getSheetByGid(TASK_SHEET_GID);
  const taskNo = Number(data.taskNo);
  if (!taskNo) throw new Error('taskNo が指定されていません');
  const lastRow = sheet.getLastRow();
  let targetRow = -1;
  for (let r = 2; r <= lastRow; r++) {
    if (Number(sheet.getRange(r, COL.NO).getValue()) === taskNo) { targetRow = r; break; }
  }
  if (targetRow === -1) throw new Error('No.' + taskNo + ' の行が見つかりません');
  const row = buildRow(taskNo, data);
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
  return { status: 'ok', no: taskNo };
}

function buildRow(no, data) {
  return [
    '',
    no,
    parseDate(data.entryDate),
    data.category    || '',
    data.status      || '未着手',
    data.taskName    || '',
    data.detail      || '',
    parseDate(data.dueDate),
    data.workHours   || '',
    parseDate(data.completedDate),
    data.assignee    || '',
  ];
}

function parseDate(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getLastNo(sheet) {
  const lastRow = sheet.getLastRow();
  for (let r = lastRow; r >= 2; r--) {
    const val = Number(sheet.getRange(r, COL.NO).getValue());
    if (val > 0) return val;
  }
  return 0;
}

function jsonpResponse(obj, callback) {
  const json = JSON.stringify(obj);
  const body = callback ? callback + '(' + json + ')' : json;
  const mime = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mime);
}

function postToSlack(text, thread_ts) {
  if (!SLACK_WEBHOOK_URL || SLACK_WEBHOOK_URL === 'YOUR_SLACK_WEBHOOK_URL') {
    throw new Error('SLACK_WEBHOOK_URL が未設定です');
  }
  const withMention = SLACK_MENTION ? SLACK_MENTION + '\n' + text : text;
  const resolved = resolveSlackMentions(withMention);
  const payload = { text: resolved };
  if (thread_ts) payload.thread_ts = thread_ts;
  const res = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload),
  });
  if (res.getResponseCode() !== 200) throw new Error('Slack投稿失敗: ' + res.getContentText());
  return { status: 'ok' };
}

function resolveSlackMentions(text) {
  return text.replace(/@(\w+)/g, (match, handle) => {
    if (handle === 'here')     return '<!here>';
    if (handle === 'channel')  return '<!channel>';
    if (handle === 'everyone') return '<!everyone>';
    const groupId = lookupSlackHandle(handle);
    if (groupId) return `<!subteam^${groupId}|@${handle}>`;
    const userId = lookupSlackUser(handle);
    if (userId) return `<@${userId}>`;
    return match;
  });
}

const _handleCache = {};
function lookupSlackHandle(handle) {
  if (_handleCache[handle] !== undefined) return _handleCache[handle];
  try {
    const res  = UrlFetchApp.fetch('https://slack.com/api/usergroups.list?include_disabled=false',
      { headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN } });
    const json = JSON.parse(res.getContentText());
    if (json.ok && json.usergroups) json.usergroups.forEach(g => { _handleCache[g.handle] = g.id; });
  } catch(_) {}
  return _handleCache[handle] || null;
}

const _userCache = {};
function lookupSlackUser(handle) {
  if (_userCache[handle] !== undefined) return _userCache[handle];
  try {
    const res  = UrlFetchApp.fetch('https://slack.com/api/users.list?limit=200',
      { headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN } });
    const json = JSON.parse(res.getContentText());
    if (json.ok && json.members) {
      json.members.forEach(m => {
        const dn = (m.profile && m.profile.display_name) ? m.profile.display_name : '';
        if (m.name) _userCache[m.name] = m.id;
        if (dn)     _userCache[dn]     = m.id;
      });
    }
  } catch(_) {}
  return _userCache[handle] || null;
}

function findSlackThread(e) {
  const callback = e.parameter.callback || '';
  if (!SLACK_BOT_TOKEN || SLACK_BOT_TOKEN === 'YOUR_SLACK_BOT_TOKEN') {
    return jsonpResponse({ status: 'error', message: 'Slack設定が未完了です' }, callback);
  }
  const res  = UrlFetchApp.fetch(
    'https://slack.com/api/conversations.history?channel=' + SLACK_CHANNEL_ID + '&limit=100',
    { headers: { Authorization: 'Bearer ' + SLACK_BOT_TOKEN } }
  );
  const json = JSON.parse(res.getContentText());
  if (!json.ok) return jsonpResponse({ status: 'error', message: 'Slack APIエラー: ' + json.error }, callback);
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年M月d日');
  const messages = json.messages || [];
  const msg = messages.find(m => m.text && m.text.includes('業務報告') && m.text.includes(today));
  if (!msg) {
    return jsonpResponse({ status: 'ok', thread_ts: null,
      debug: { today, count: messages.length, sample: messages.slice(0,3).map(m=>(m.text||'').substring(0,60)) }
    }, callback);
  }
  return jsonpResponse({ status: 'ok', thread_ts: msg.ts }, callback);
}
