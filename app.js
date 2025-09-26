function toggleSidebar() {
  const sidebars = document.getElementById("sidebars");
  const main = document.getElementById("main");
  sidebars.classList.toggle("open");
  main.classList.toggle("shifted");
}



// OH-=========================================
//  テーマ機能オープン&クローズ
// OH-=========================================
document.addEventListener("DOMContentLoaded", () => {
  const themeSection = document.getElementById("themeSection");
  
  // OH-オープンボタン
  const openThemeBtn = document.getElementById("openThemeBtn");
  openThemeBtn.addEventListener("click", () => {
    themeSection.style.display = themeSection.style.display === "none" ? "block" : "none";
  });

  // OH-クローズボタン
  const closeThemeBtn = document.getElementById("closeThemeBtn");
  closeThemeBtn.addEventListener("click", () => {
    themeSection.style.display = "none";
  });
});



// OH-=========================================
//  管理者モード起動機能
// OH-=========================================
document.addEventListener("DOMContentLoaded", () => {
  const adminStatus = document.getElementById("adminStatus");
  let passwordValidated = false;
  let inputData = null;

  // OH-起動
  adminStatus.addEventListener("click", () => {
    if (passwordValidated) {
      alert("すでに管理者モードです");
    } else {
      inputData = prompt("管理者パスワードを入力してください");
      if (inputData === "supersecret") {
        passwordValidated = true;
        adminStatus.textContent = "管理者モード有効化[有効!!]";
        adminStatus.style.color = "yellow";
        alert("管理者モードが有効になりました");
      } else {
        alert("認証失敗");
      }
    }
  });
});

/*
OH- 2025/09/24
  やっとコードを共有されたが、明らかに冗長な部分が多いコードであった。
  例えば、テーマ設定の部分はもっと簡潔にできるし、管理者モードの部分も一つの関数にまとめられる。(現時点では2つあるのだ)
  この改善点を踏まえて、コード全体をリファクタリングして、可読性と保守性を向上させる必要がある。
  また、コメントも適切に追加して、各関数の役割を明確にすることも重要である。
  これらの点を改善することで、コードの品質が向上し、将来的な拡張や修正が容易になるだろう。
  
  更に、エラーハンドリングも強化する必要がある。現在のコードでは、GASとの通信が失敗した場合の処理が不十分であり、ユーザーに適切なフィードバックを提供できていない。
  例えば、通信エラーが発生した場合には、ユーザーに再試行のオプションを提供するなどの対応が考えられる。
  最後に、コードの一貫性を保つために、命名規則やコードスタイルを統一することも重要である。これにより、他の開発者がコードを理解しやすくなり、チームでの協力が円滑になるだろう。

  こんなことを考えているが上記の内容を見てもらうと分かる通り、
  著者はJSは始めて触ってから3時間、htmlとCSSは2年前にほんの少し触った程度の者である。
  そのため、"『飛嶋朝陽』さんが夏休みとAIを使って作ったコード"が"著者のコード"より劣るはずはない。
  更に言えば、『飛嶋朝陽』さんに著者がコードレビューをした際の感想(「可読性が低すぎる、単一責任の原則が守られていない」)を伝えたところ、
  「そんなこと言うなら、自分でやればいいじゃん」
  と言われた。
  『飛嶋朝陽』さんの発言は正しいのだろう。今でも申し訳ないと思っている。
  理由としてはいくつかあり、以下の通りである。
    ・私は夏休み中に企画の為にJavaFX及びJavaを勉強していたためである。
      私はその時、夏休みの全ての予定と夏休み中の半分の睡眠時間しか代償として消費していない。
      つまり、誕生日プレゼントでエナドリを要求して、睡眠をせずに『飛嶋朝陽』さんを手伝うこともできから。
      まさか、『飛嶋朝陽』さんが夏休みの全ての予定と夏休み中の半分以上の睡眠時間を代償にしていないなんてことはないはずだ。
      その時はそこまで、私は考えが及ばなかった。
      あとで、エナドリを大量に贈ろうと思う。
    ・そもそも、JavaScriptでの開発経験が全くなかったためである。
      というのも、独学で少しでも、プログラミングをしていれば、"単一責任の原則"なんて言葉は知っているはずである。
      つまり、『飛嶋朝陽』さんは"単一責任の原則"なんて言葉は知っているはずである。
      とすれば、私は"単一責任の原則"が全てのプログラミング言語に共通する概念だと誤解していたとしか考えられない。
      JavaScriptには"単一責任の原則"を適応できないのだろう。
      この"単一責任の原則"を全く守られていないコードを見る限りそうとしか思えない。
  この2つの理由が完全に正であると『飛嶋朝陽』さんに指摘されたため、
  全面的に私が悪いと考えられる。
*/

/*
OH- 2025/09/25
  参照されていない関数6つの削除を行った。
  未だに、何の為にあったのかが分からない。
  依存関係が分からなかったためもしかしたら、必要な関数を削除してしまった可能性がある。
  しかし、それは私には判断が付かない。
*/


const GAS_URL = "https://script.google.com/macros/s/AKfycby_8v7Gie_f3cdNv8OA5-R3VLVBvPB7rjgAaVuDBbUXKsOMI9AVLyIbaoVpBovGJQ8/exec";
const SECRET_KEY = "your-secret-key";

const SCAN_COOLDOWN_MS = 1500;
const MAX_PLAYERS_PER_SEAT = 6;
const MAX_HISTORY_ITEMS = 100; // 保存する履歴の上限
const pendingResults = {};

let currentSeatId = null;
let seatMap = {};
let playerData = {};
let undoStack = [];
let redoStack = [];
let scanQr = null;
let rankQr = null;
let isScanCameraStarting = false;
let isRankCameraStarting = false;
let isRankingMode = false;
let currentRankingSeatId = null;
let lastScannedText = null;
let lastScanTime = 0;
let msgTimer = null;
let douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords") || "[]");
let lastScrollTop = 0;
let scrollTimeout;
let historyLog = JSON.parse(localStorage.getItem("historyLog") || "[]");
let historyFilterText = "";  // 空文字で初期化

// =====================
// テーマ設定
// =====================
let themeConfig = {
  seatBox: { backgroundColor: "#f5f5f5", color: "#000000" },
  playerEntry: { backgroundColor: "#d0f0c0", color: "#000000" },
  button: { backgroundColor: "#4CAF50", color: "#ffffff" },
  fontSize: "14px"
};

// テーマ適用関数
function applyTheme() {
  document.querySelectorAll(".seat-box").forEach(el=>{
    el.style.backgroundColor = themeConfig.seatBox.backgroundColor;
    el.style.color = themeConfig.seatBox.color;
    el.style.fontSize = themeConfig.fontSize;
  });
  document.querySelectorAll(".player-entry").forEach(el=>{
    el.style.backgroundColor = themeConfig.playerEntry.backgroundColor;
    el.style.color = themeConfig.playerEntry.color;
    el.style.fontSize = themeConfig.fontSize;
  });
  document.querySelectorAll("button").forEach(el=>{
    el.style.backgroundColor = themeConfig.button.backgroundColor;
    el.style.color = themeConfig.button.color;
    el.style.fontSize = themeConfig.fontSize;
  });
}

// =====================
// イベントバインド
// =====================
window.addEventListener("DOMContentLoaded", ()=>{
  const applyThemeBtn = document.getElementById("applyThemeBtn");
  applyThemeBtn.addEventListener("click", ()=>{
    themeConfig.seatBox.backgroundColor = document.getElementById("seatBgColor").value;
    themeConfig.playerEntry.backgroundColor = document.getElementById("playerBgColor").value;
    themeConfig.button.backgroundColor = document.getElementById("buttonBgColor").value;
    themeConfig.button.color = document.getElementById("buttonColor").value;
    themeConfig.fontSize = document.getElementById("fontSizeInput").value + "px";
    applyTheme();
  });
  applyTheme(); // 初期テーマ適用
});

// =====================
// ユーティリティ
// =====================
const delay = ms => new Promise(res=>setTimeout(res,ms));

function displayMessage(msg){
  const area=document.getElementById("messageArea");
  if(!area) return;
  area.textContent=msg;
  clearTimeout(msgTimer);
  msgTimer=setTimeout(()=>area.textContent="",3000);
}

async function requireAuth(callback){
  if(passwordValidated) return callback();
  const pw=prompt("パスワードを入力してください");
  if(pw==="supersecret"){ passwordValidated=true; callback(); }
  else alert("認証失敗");
}

function navigate(targetId){
  document.querySelectorAll('.section').forEach(s=>s.style.display='none');
  const target=document.getElementById(targetId);
  if(target) target.style.display='block';
  location.hash=targetId;

  switch(targetId){
    case 'historySection': loadDouTakuHistory(); break;
    case 'rankingSection':
      requireAuth(()=>{
        isRankingMode=true;
        currentRankingSeatId=null;
        document.getElementById("rankingList").innerHTML="";
        displayMessage("座席QR を読み込んでください（順位登録モード）");
        startRankCamera();
      });
      break;
    case 'scanSection':
      isRankingMode=false;
      stopRankCamera().then(startScanCamera);
      break;
  }
}



function notifyAction(message){
  const msg = document.createElement("div");
  msg.className = "notify-popup";
  msg.textContent = message;
  document.body.appendChild(msg);
  setTimeout(()=>msg.remove(),3000);

  const audio = new Audio("https://freesound.org/data/previews/170/170186_2437358-lq.mp3");
  audio.play().catch(()=>{});
}

function onQrScanSuccess(data){ notifyAction(`この座席で「${data}」を登録しました！`); }

// =====================
// QRスキャン
// =====================
function handleScanSuccess(decodedText){
  const now = Date.now();
  if(decodedText === lastScannedText && now - lastScanTime < SCAN_COOLDOWN_MS) return;
  lastScannedText = decodedText;
  lastScanTime = now;
  
  const resultEl = document.getElementById("result");
  if(resultEl) resultEl.textContent = `📷 ${decodedText} を読み取りました`;

  if(decodedText.startsWith("table")){
    currentSeatId = decodedText;
    seatMap[currentSeatId] ??= [];
    displayMessage(`✅ 座席セット: ${currentSeatId}`);
    if(isRankingMode) handleRankingScan(decodedText);

  } else if(decodedText.startsWith("player")){
    if(!currentSeatId){
      displayMessage("⚠ 先に座席QRを読み込んでください");
      return;
    }
    if(!passwordValidated){
      displayMessage("⚠ 管理者モードでのみ操作可能です");
      return;
    }
    if(seatMap[currentSeatId].includes(decodedText)){
      displayMessage("⚠ 既に登録済み");
      return;
    }
    if(seatMap[currentSeatId].length >= MAX_PLAYERS_PER_SEAT){
      displayMessage(`⚠ この座席は${MAX_PLAYERS_PER_SEAT}人まで`);
      return;
    }

    // プレイヤー追加
    seatMap[currentSeatId].push(decodedText);
    playerData[decodedText] ??= { nickname: decodedText };
    saveAction({ type: "addPlayer", seatId: currentSeatId, playerId: decodedText });

    displayMessage(`✅ ${decodedText} 追加`);
    renderSeats();

    // GASに即時送信は行わない
    // sendSeatData(currentSeatId, seatMap[currentSeatId], 'webUser');

    // 履歴に記録（ローカル保存は廃止）
    douTakuRecords.push({
      seatId: currentSeatId,
      playerId: decodedText,
      action: "登録",
      time: new Date().toLocaleString()
    });
  }
}

// =====================
// GAS保存ボタンバインド
// =====================
function bindGASSaveButton(){
  const btn = document.getElementById("saveToGASBtn");
  if(!btn) return;

  btn.addEventListener("click", () => {
    requireAuth(async () => {
      try {
        await saveToGAS(seatMap, playerData);
        displayMessage("💾 GASに保存しました");
      } catch(err){
        console.error(err);
        displayMessage("❌ GAS保存に失敗しました");
      }
    });
  });
}

// =====================
// QR紐づけの自動履歴ログ
// =====================
function logAction(playerId, seatId, action = "参加", extra = {}) {
  const entry = {
    time: new Date().toLocaleString("ja-JP", { hour12: false }),
    playerId,
    seatId: seatId || null,
    action,
    rank: extra.rank || null
  };

  // マスター配列に追加
  douTakuRecords.push(entry);
  if (douTakuRecords.length > MAX_HISTORY_ITEMS) douTakuRecords.shift();

  // localStorage保存
  localStorage.setItem("douTakuRecords", JSON.stringify(douTakuRecords));

  // 画面描画更新
  renderHistory();

  // GAS送信
  sendHistoryEntry(entry).catch(e => console.warn("履歴送信失敗", e));
}

// =====================
// 座席描画
// =====================
function renderSeats() {
  const seatList = document.getElementById("seatList");
  if (!seatList) return;
  seatList.innerHTML = "";

  Object.entries(seatMap).forEach(([seatId, players]) => {
    const seatDiv = document.createElement("div");
    seatDiv.className = "seat-box";

    // 座席名 + 削除ボタン 横並び
    const seatHeader = document.createElement("div");
    seatHeader.className = "seat-header"; // CSSでflexなどを指定

    const seatName = document.createElement("strong");
    seatName.textContent = seatId;
    seatHeader.appendChild(seatName);

    const removeSeatBtn = document.createElement("button");
    removeSeatBtn.textContent = "✖";
    removeSeatBtn.className = "remove-seat-button"; // CSSで見た目統一
    removeSeatBtn.addEventListener("click", () => removeSeat(seatId));
    seatHeader.appendChild(removeSeatBtn);

    seatDiv.appendChild(seatHeader);

    // プレイヤーリスト
    players.forEach(pid => {
      const entryDiv = document.createElement("div");
      entryDiv.className = "player-entry";

      const playerName = document.createElement("strong");
      playerName.textContent = pid;
      entryDiv.appendChild(playerName);

      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-button";
      removeBtn.textContent = "✖";
      removeBtn.addEventListener("click", () => removePlayer(seatId, pid));
      entryDiv.appendChild(removeBtn);

      seatDiv.appendChild(entryDiv);
    });

    seatList.appendChild(seatDiv);
  });
}

// =====================
// プレイヤー追加/削除
// =====================


function removePlayer(seatId, playerId){
  if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
  if(!confirm(`⚠️ 座席「${seatId}」から「${playerId}」を削除しますか？`)) return;

  const idx=seatMap[seatId]?.indexOf(playerId); if(idx===-1) return;
  seatMap[seatId].splice(idx,1);
  saveAction({ type:"removePlayer", seatId, playerId, index: idx });
  saveToLocalStorage(); renderSeats();
  sendSeatData(seatId, seatMap[seatId],'webUser');

  logAction(playerId, seatId, "削除");
  displayMessage(`❌ ${playerId} 削除`);
}

function removeSeat(seatId){
  if(!passwordValidated){ displayMessage("⚠ 管理者モードでのみ操作可能です"); return; }
  if(!confirm(`⚠️ 座席「${seatId}」を削除しますか？中のプレイヤーもすべて削除されます`)) return;

  // ローカルデータ削除
  delete seatMap[seatId];

  // ローカル表示更新
  saveToLocalStorage();
  renderSeats();

  // GASに反映
  callGAS({ mode: "deleteSeat", seatId, secret: SECRET_KEY })
    .then(res => {
      if(res.success) displayMessage(`✅ 座席 ${seatId} 削除完了`);
      else displayMessage(`❌ 座席削除失敗: ${res.error || "不明"}`);
    }).catch(err => {
      console.error(err);
      displayMessage("❌ 座席削除失敗");
    });
}

// =====================
// Undo / Redo
// =====================
function saveAction(action){ undoStack.push(action); redoStack=[]; }

function undoAction(){
  if(!undoStack.length){ displayMessage("元に戻す操作がありません"); return; }
  const last=undoStack.pop();
  redoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId]=seatMap[last.seatId].filter(p=>p!==last.playerId); break;
    case "removePlayer": seatMap[last.seatId]?.splice(last.index,0,last.playerId); break;
  }
  saveToLocalStorage(); renderSeats(); displayMessage("↩ 元に戻しました");
}

function redoAction(){
  if(!redoStack.length){ displayMessage("やり直す操作がありません"); return; }
  const last=redoStack.pop();
  undoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId]??=[]; seatMap[last.seatId].push(last.playerId); break;
    case "removePlayer": seatMap[last.seatId]=seatMap[last.seatId].filter(p=>p!==last.playerId); break;
  }
  saveToLocalStorage(); renderSeats(); displayMessage("↪ やり直しました");
}

// =====================
// 履歴描画
// =====================
function loadDouTakuHistory() {
  douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords") || "[]");
  renderHistory();
}

// =====================
// ローカル保存・復元
// =====================
function saveToLocalStorage(){
  localStorage.setItem("seatMap",JSON.stringify(seatMap));
  localStorage.setItem("playerData",JSON.stringify(playerData));
}

function loadFromLocalStorage(){
  seatMap=JSON.parse(localStorage.getItem("seatMap")||"{}");
  playerData=JSON.parse(localStorage.getItem("playerData")||"{}");
  renderSeats();
}

// =====================
// 順位登録
// =====================
function handleRankingScan(decodedText) {
  // tableQR以外は警告
  if (!decodedText.startsWith("table")) {
    displayMessage("⚠️ 順位登録は座席QRのみ対応しています");
    return;
  }
  const seatId = decodedText;

  // 座席にプレイヤーがいない場合
  if (!seatMap[seatId]?.length) {
    displayMessage(`⚠️ ${seatId} にはプレイヤーが登録されていません`);
    return;
  }

  // multiRankingArea が存在しない場合は自動生成
  let container = document.getElementById("multiRankingArea");
  if (!container) {
    container = document.createElement("div");
    container.id = "multiRankingArea";
    document.getElementById("rankingSection").appendChild(container);
  }

  // 座席ごとのコンテナ取得or生成
  let seatDiv = document.getElementById(`ranking-${seatId}`);
  if (!seatDiv) {
    seatDiv = document.createElement("div");
    seatDiv.id = `ranking-${seatId}`;
    seatDiv.className = "ranking-seat";

    seatDiv.innerHTML = `
      <h3>${seatId}</h3>
      <ul id="list-${seatId}" class="ranking-list"></ul>
      <button class="finalizeBtn" data-seat="${seatId}">順位確定</button>
    `;

    container.appendChild(seatDiv);

    // 確定ボタンのイベント
    seatDiv.querySelector(".finalizeBtn").addEventListener("click", () => finalizeRanking(seatId));
  }

  // プレイヤーリスト表示（ID + 名前）
  const list = seatDiv.querySelector("ul");
  list.innerHTML = "";
  seatMap[seatId].forEach(player => {
    const li = document.createElement("li");
    li.className = "draggable-item";
    li.draggable = true;
    li.dataset.id = player.id ?? player; // playerがオブジェクトかIDか両方対応
    li.textContent = player.name ? `${player.id} - ${player.name}` : player.id ?? player;
    list.appendChild(li);
  });

  enableDragSort(`list-${seatId}`);
  displayMessage(`✅ ${seatId} のプレイヤーを読み込みました`);
}

function enableDragSort(listId){
  const list = document.getElementById(listId);
  let dragged = null; // リスト単位で閉じる

  list.querySelectorAll(".draggable-item").forEach(item => {
    item.addEventListener("dragstart", () => dragged = item);
    item.addEventListener("dragend", () => dragged = null);
    item.addEventListener("dragover", e => e.preventDefault());
    item.addEventListener("drop", e => {
      e.preventDefault();
      if(dragged && dragged !== item){
        const items = Array.from(list.children);
        const di = items.indexOf(dragged), ii = items.indexOf(item);
        if(di < ii) list.insertBefore(dragged, item.nextSibling);
        else list.insertBefore(dragged, item);
      }
    });
  });
}

async function finalizeRanking(seatId) {
  if (!confirm("⚠️ この順位を確定しますか？")) return;

  const list = document.getElementById(`list-${seatId}`);
  if (!list) return;

  // ドラッグ順序から playerId を抽出
  const rankedIds = Array.from(list.children).map(li => li.dataset.id);
  if (rankedIds.length < 2) {
    displayMessage("⚠️ 2人以上必要です");
    return;
  }

  // { playerId, rank } 形式に変換
  const entries = rankedIds.map((playerId, index) => ({
    playerId,
    rank: index + 1
  }));

  // pendingResults に座席IDと一緒に格納
  pendingResults[seatId] = {
    seatId,
    entries
  };

  // UIリセット（必要に応じて seatMap もクリア）
  if (seatMap[seatId]) {
    seatMap[seatId] = [];
    renderSeats();
  }

  // カメラ停止（座席単位）
  await stopRankCamera();

  displayMessage(`✅ ${seatId} の順位を保留しました。まとめて送信可能です`);
}

// =====================
// GAS通信（プリフライト回避版）
// =====================
async function callGAS(payload = {}, options = {}) {
  // GAS で受信可能な形式に secret を必ず付与
  payload.secret = SECRET_KEY;

  const maxRetries = options.retries ?? 3;  // 最大リトライ回数
  const timeoutMs  = options.timeout ?? 15000; // タイムアウト(ms)
  let attempt = 0;

  while (attempt < maxRetries) {
    // タイムアウト制御用の AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // プリフライト回避のため text/plain で送信
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      // タイマークリア
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // JSON レスポンスを返す
      return await res.json();

    } catch (err) {
      attempt++;
      console.warn("GAS通信リトライ", attempt, err);

      // 1秒待機して再試行
      await new Promise(r => setTimeout(r, 1000));

      if (attempt >= maxRetries) throw err;
    }
  }
}

// =====================
// 保存
// =====================
async function saveToGAS(seatMapData, playerDataObj) {
  try {
    const res = await callGAS({ mode: "saveData", seatMap: seatMapData, playerData: playerDataObj });
    if (!res.success) throw new Error(res.error || "保存失敗");
    displayMessage("✅ データ保存成功");
  } catch (err) {
    console.error("GAS保存失敗", err);
    displayMessage("❌ データ保存失敗");
  }
}

// =====================
// 読み込み
// =====================
async function loadFromGAS() {
  try {
    const res = await callGAS({ mode: "loadData" });
    seatMap = res.seatMap || {};
    playerData = res.playerData || {};
    renderSeats();
    displayMessage("✅ データ読み込み成功");
  } catch (err) {
    console.error("GAS読み込み失敗", err);
    displayMessage("❌ データ読み込み失敗");
  }
}

// =====================
// 座席更新
// =====================
async function sendSeatData(tableID, playerIds, operator = 'webUser') {
  try {
    await syncSeatData(seatMap);

    const filteredPlayers = playerIds.filter(pid => {
      for (const seat in seatMap) {
        if (seatMap[seat]?.includes(pid)) return false;
      }
      return true;
    });

    if (filteredPlayers.length === 0) {
      displayMessage("⚠ このプレイヤーはすでに登録されています");
      return;
    }

    seatMap[tableID] = filteredPlayers;
    const res = await callGAS({ mode: "updatePlayers", tableID, players: filteredPlayers, operator });

    if (!res.success) throw new Error(res.error || "座席更新失敗");

    renderSeats();
    displayMessage(`✅ 座席 ${tableID} 更新成功`);
    playNotification();

  } catch (err) {
    console.error('座席送信失敗', err);
    displayMessage("❌ 座席送信失敗");
  }
}

// =====================
// 履歴送信
// =====================
async function sendHistoryEntry(entry, retries = 3, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await callGAS({ mode: "addHistory", entry });
      if (!res.success) throw new Error(res.error || "履歴送信失敗");

      const statusContainer = document.getElementById("historyStatus");
      if (statusContainer) statusContainer.textContent = `✅ 送信成功: ${entry.playerId}`;
      return true;

    } catch (e) {
      console.warn(`⚠️ 履歴送信失敗 (${attempt}/${retries}): ${entry.playerId}`, e);
      if (attempt < retries) await new Promise(r => setTimeout(r, delayMs));
      else {
        const statusContainer = document.getElementById("historyStatus");
        if (statusContainer) statusContainer.textContent = `❌ 送信失敗: ${entry.playerId}`;
        return false;
      }
    }
  }
}

// =====================
// 順位登録
// =====================


// =====================
// 履歴取得（ポーリング）
// =====================
async function pollHistory() {
  try {
    const res = await callGAS({ mode: "loadHistory" });
    douTakuRecords = Array.isArray(res.history) ? res.history : [];
    renderHistory();
  } catch (e) {
    console.warn("履歴取得失敗", e);
  }
}

setInterval(pollHistory, 10000);

// =====================
// カメラ制御
// =====================

// =====================
// UI更新ユーティリティ
// =====================
function updateCameraUI() {
  const startScanBtn = document.getElementById("startScanBtn");
  const stopScanBtn = document.getElementById("stopScanBtn");
  const startRankBtn = document.getElementById("startRankBtn");
  const stopRankBtn = document.getElementById("stopRankBtn");

  if (startScanBtn) startScanBtn.disabled = !!scanQr || isScanCameraStarting;
  if (stopScanBtn) stopScanBtn.disabled = !scanQr;
  if (startRankBtn) startRankBtn.disabled = !!rankQr || isRankCameraStarting;
  if (stopRankBtn) stopRankBtn.disabled = !rankQr;
}

// 通常スキャンカメラ起動
// =====================
async function startScanCamera() {
  const readerElem = document.getElementById("reader");
  if (!readerElem) {
    console.warn("startScanCamera: reader要素が存在しません");
    return;
  }
  if (isScanCameraStarting || scanQr) return; // 二重起動防止

  isScanCameraStarting = true;
  updateCameraUI();

  try {
    scanQr = new Html5Qrcode("reader");
    await scanQr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 350 },
      handleScanSuccess
    );
    console.log("Scanカメラ起動成功");
    displayMessage("✅ Scanカメラ起動");
  } catch (e) {
    console.error("Scanカメラ起動失敗", e);
    displayMessage("❌ Scanカメラ起動失敗");
    scanQr = null;
  } finally {
    isScanCameraStarting = false;
    updateCameraUI();
  }
}

// =====================
// 順位登録カメラ起動
// =====================
async function startRankCamera() {
  const rankElem = document.getElementById("rankingReader");
  if (!rankElem) {
    console.warn("startRankCamera: rankingReader要素が存在しません");
    return;
  }
  if (isRankCameraStarting || rankQr) return; // 二重起動防止

  isRankCameraStarting = true;
  updateCameraUI();

  try {
    rankQr = new Html5Qrcode("rankingReader");
    await rankQr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 200 },
      handleRankingScan
    );
    console.log("Rankカメラ起動成功");
    displayMessage("✅ Rankカメラ起動");
  } catch (e) {
    console.error("Rankカメラ起動失敗", e);
    displayMessage("❌ Rankカメラ起動失敗");
    rankQr = null;
  } finally {
    isRankCameraStarting = false;
    updateCameraUI();
  }
}

// =====================
// 通常スキャンカメラ停止
// =====================
async function stopScanCamera() {
  if (!scanQr) return;

  try {
    await scanQr.stop();

    // clear前に要素が存在するか確認
    const readerElem = document.getElementById("reader");
    if (readerElem && readerElem.parentNode) {
      await scanQr.clear();
    }

    console.log("Scanカメラ停止完了");
    displayMessage("🛑 Scanカメラ停止");
  } catch (e) {
    console.warn("stopScanCameraエラー:", e);
    displayMessage("⚠️ Scanカメラ停止エラー");
  } finally {
    scanQr = null;
    isScanCameraStarting = false;
    updateCameraUI();
  }
}

// =====================
// 順位登録カメラ停止
// =====================
async function stopRankCamera() {
  if (!rankQr) return; // カメラ未起動なら即リターン

  try {
    // 1) カメラ停止
    await rankQr.stop();

    // 2) DOM要素が存在する場合のみ処理
    const rankElem = document.getElementById("rankingReader");
    if (rankElem) {
      // clear() は内部で removeChild を行うため try-catch 保護
      if (typeof rankQr.clear === "function") {
        try {
          await rankQr.clear();
        } catch (clearErr) {
          console.warn("Rankカメラ clear() 失敗:", clearErr);
        }
      }
      // 念のため DOMも手動でクリア（UI残り防止）
      rankElem.innerHTML = "";
    }

    console.log("Rankカメラ停止完了");
    displayMessage("🛑 Rankカメラ停止");
  } catch (e) {
    console.warn("stopRankCameraエラー:", e);
    displayMessage("⚠️ Rankカメラ停止エラー");
  } finally {
    // 3) 状態リセット
    rankQr = null;
    isRankCameraStarting = false;
    updateCameraUI(); // UI表示更新
  }
}

// =====================
// 全カメラ停止ユーティリティ
// =====================
async function stopAllCameras() {
  await Promise.all([stopScanCamera(), stopRankCamera()]);
}

// =====================
// CSVエクスポート
// =====================
function toCSV(data, headers){
  const rows=[headers.join(",")];
  data.forEach(row=>{
    rows.push(headers.map(h=>{
      let v=row[h]??"";
      if(typeof v==="string" && v.includes(",")) v=`"${v.replace(/"/g,'""')}"`;
      return v;
    }).join(","));
  });
  return rows.join("\n");
}

function downloadCSV(csvText, filename){
  const blob=new Blob([csvText], {type:"text/csv;charset=utf-8;"}), url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

window.exportPlayerCSV = ()=>{
  const players=[];
  Object.entries(seatMap).forEach(([seatID,playerList])=>playerList.forEach(playerID=>players.push({playerID,seatID})));
  if(players.length===0){ displayMessage("⚠ エクスポートデータなし"); return; }
  downloadCSV(toCSV(players,["playerID","seatID"]),"players.csv");
};

window.exportSeatCSV = ()=>{
  const seats=[];
  Object.entries(seatMap).forEach(([seatID,playerList])=>seats.push({seatID,players:playerList.join("|")}));
  if(seats.length===0){ displayMessage("⚠ エクスポートデータなし"); return; }
  downloadCSV(toCSV(seats,["seatID","players"]),"seats.csv");
};

document.getElementById("closeHelpBtn")?.addEventListener("click", ()=>{
  const help = document.getElementById("helpSection");
  if (help) help.style.display = "none";
});

// =====================
// 履歴描画
// =====================
// フィルター入力イベント
document.getElementById("historyFilterInput")?.addEventListener("input", e => {
  historyFilterText = e.target.value.trim().toLowerCase();
  renderHistory();
});

// 履歴描画（フィルター対応）
function renderHistory() {
  const container = document.getElementById("historyList");
  if (!container) return;
  container.innerHTML = "";

  const safeHistory = Array.isArray(douTakuRecords) ? douTakuRecords.slice().reverse() : [];

  const filtered = safeHistory.filter(entry => {
    if (!historyFilterText) return true;
    const text = historyFilterText.toLowerCase();
    return (entry.playerId?.toLowerCase().includes(text) ||
            entry.seatId?.toLowerCase().includes(text) ||
            entry.action?.toLowerCase().includes(text));
  });

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "history-empty";
    emptyDiv.textContent = "🔕 履歴がありません";
    container.appendChild(emptyDiv);
  } else {
    filtered.forEach(entry => {
      const div = document.createElement("div");
      div.className = "history-entry";
      div.textContent = `[${entry.time || "不明"}] ${entry.playerId || "不明"} → ${entry.seatId || "N/A"} : ${entry.action || "不明"}` +
                        (entry.rank ? `（順位: ${entry.rank}位）` : "");
      container.appendChild(div);
    });
  }

  container.scrollTop = container.scrollHeight;
}

function exportRankingHistoryCSV(){
  if(douTakuRecords.length === 0){
    displayMessage("⚠️ 履歴がありません");
    return;
  }

  const header = ["playerId","rank","action","seatId","time"];
  const rows = douTakuRecords.map(r => [
    r.playerId, r.rank, r.action, r.seatId ?? "", r.time
  ]);

  const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], {type: "text/csv"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking_history_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  displayMessage("✅ 履歴CSVを出力しました");
}

function exportHistoryCSV() {
  if (douTakuRecords.length === 0) { displayMessage("⚠️ 履歴なし"); return; }

  const headers = ["time", "playerId", "seatId", "action", "rank"];
  const rows = douTakuRecords.map(r => [
    r.time,
    r.playerId,
    r.seatId ?? "",
    r.action,
    r.rank ?? ""
  ]);
  const csvText = [headers, ...rows].map(r => r.join(",")).join("\n");

  const blob = new Blob([csvText], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `history_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  displayMessage("✅ 履歴CSV出力完了");
}

document.getElementById("welcomeScreen").addEventListener("click", async () => {
  const welcome = document.getElementById("welcomeScreen");
  
  // フェードアウトアニメーション
  welcome.classList.add("hide");
  
  // 500ms待って画面遷移
  setTimeout(() => {
    welcome.style.display = "none";
    navigate("scanSection"); // 既存の順位登録モードに遷移
  }, 500);
});

// =====================
// 初期化
// =====================
function bindButtons() {
  document.getElementById("undoBtn")?.addEventListener("click", undoAction);
  document.getElementById("redoBtn")?.addEventListener("click", redoAction);
  document.getElementById("exportPlayerBtn")?.addEventListener("click", exportPlayerCSV);
  document.getElementById("exportSeatBtn")?.addEventListener("click", exportSeatCSV);
  document.getElementById("confirmRankingBtn")?.addEventListener("click", finalizeRanking);
  document.getElementById("saveToGASBtn")?.addEventListener("click", () => requireAuth(() => saveToGAS(seatMap, playerData)));
  document.getElementById("loadFromGASBtn")?.addEventListener("click", () => requireAuth(loadFromGAS));
  document.getElementById("exportHistoryBtn")?.addEventListener("click", exportRankingHistoryCSV);
  document.getElementById("startScanBtn")?.addEventListener("click", startScanCamera);
  document.getElementById("stopScanBtn")?.addEventListener("click", stopScanCamera);
  document.getElementById("startRankBtn")?.addEventListener("click", startRankCamera);
  document.getElementById("stopRankBtn")?.addEventListener("click", stopRankCamera);
};

  document.addEventListener("DOMContentLoaded", async () => {
    try { 
      await loadFromGAS(); 
    }   catch (e) { 
    console.warn("GASロード失敗,ローカル使用", e); 
  }
  loadFromLocalStorage();
  updateCameraUI();
  renderSeats();
  applyTheme();
  bindButtons();
  bindGASSaveButton();
  startScanCamera();
  
  // スクロールでサイドバー自動開閉
  window.addEventListener("scroll", () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    const st = window.pageYOffset || document.documentElement.scrollTop;
    if (st > lastScrollTop) sidebar?.classList.add("closed"); 
    else sidebar?.classList.remove("closed");
    lastScrollTop = st <= 0 ? 0 : st;
    scrollTimeout = setTimeout(() => sidebar?.classList.remove("closed"), 1500);
  
}); // ここでDOMContentLoadedの括弧を閉じる
})
// window に関数を登録
Object.assign(window, {
  navigate,
  undoAction,
  redoAction,
  removePlayer,
  exportPlayerCSV,
  exportSeatCSV,
}); 
