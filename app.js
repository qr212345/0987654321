// ============================================
// グローバル定数・状態
// ============================================
let qrReader;
let scanQr;
let rankQr;

const GAS_URL = "https://script.google.com/macros/s/AKfycbygpqW4VYNm__Wip39CwAwoyitrTi4CPAg4N6lH7WPOPkcU37LbzS2XiNn-xvWzEI84/exec";
const ENDPOINT = "https://script.google.com/macros/s/AKfycbyhvqBiHIAsVYfUDw5e3Bz6L83OkwuZEFL-YCFHCNBi7MrUb7zQx1EV1RxZKTD62QED/exec";
const gas_URL = "https://script.google.com/macros/s/AKfycbzPUOz4eCsZ7RVm4Yf_VPu1OC5nn2yIOPa5U-tT7ZMHpw0FRNsHaqovbX7vSaEHjPc/exec";

const SECRET = 'kosen-brain-super-secret';
const SCAN_COOLDOWN_MS = 1500;
const POLL_INTERVAL_MS = 20000;  // 端末間同期（短時間バッチ）
const MAX_PLAYERS_PER_SEAT = 6;

// データ構造と状態
let currentSeatId = null;
let seatMap       = {}; // { seatId: [playerId, ...] }
let playerData    = {}; // { playerId: {nickname, rate, lastRank, bonus, title} }
let actionHistory = [];
let undoStack     = [];
let redoStack     = [];

let qrActive             = false;
let rankingQrReader      = null;
let isRankCameraStarting = false;
let isScanCameraStarting = false;
let isRankingMode        = false;
let currentRankingSeatId = null;

let lastScannedText = null;
let lastScanTime    = 0;
let msgTimer        = null;

let pollTimer       = null;
let lastScrollTop   = 0;
let scrollTimeout   = null;

// ============================================
// ユーティリティ関数
// ============================================
const delay = ms => new Promise(res => setTimeout(res, ms));

function displayMessage(msg) {
  const area = document.getElementById("messageArea");
  if (!area) return;
  area.textContent = msg;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (area.textContent = ""), 3000);
}

function navigateAsync(sectionId) {
  return new Promise(resolve => {
    if (window.isNavigating) {
      console.warn("遷移中なのでスキップ");
      resolve();
      return;
    }
    window.isNavigating = true;
    document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';
    location.hash = sectionId;
    setTimeout(() => {
      window.isNavigating = false;
      resolve();
    }, 300);
  });
}

function confirmRanking() {
  return window.confirm("この順位で確定してもよろしいですか？");
}

// ============================================
// QRコード読み取り
// ============================================
function handleScanSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScannedText && now - lastScanTime < SCAN_COOLDOWN_MS) return;
  lastScannedText = decodedText;
  lastScanTime = now;

  const resultEl = document.getElementById("result");
  if (resultEl) resultEl.textContent = `📷 ${decodedText} を読み取りました`;

  if (decodedText.startsWith("table")) {
    // 座席QR
    currentSeatId = decodedText;
    seatMap[currentSeatId] ??= [];
    displayMessage(`✅ 座席セット: ${currentSeatId}`);

    if (isRankingMode) handleRankingScan(decodedText);

  } else if (decodedText.startsWith("player")) {
    if (!currentSeatId) {
      displayMessage("⚠ 先に座席QRを読み込んでください");
      return;
    }

    // 同じ座席に登録済みの人は追加不可
    if (seatMap[currentSeatId].includes(decodedText)) {
      displayMessage("⚠ 既に登録済み");
      return;
    }

    // 最大人数チェック
    if (seatMap[currentSeatId].length >= MAX_PLAYERS_PER_SEAT) {
      displayMessage(`⚠ この座席は${MAX_PLAYERS_PER_SEAT}人まで`);
      return;
    }

    seatMap[currentSeatId].push(decodedText);
    playerData[decodedText] ??= { nickname: decodedText, rate: 50, lastRank: null, bonus: 0, title: null };
    saveAction({ type: "addPlayer", seatId: currentSeatId, playerId: decodedText });
    displayMessage(`✅ ${decodedText} 追加`);

    saveToLocalStorage();
    renderSeats();
    sendSeatData(currentSeatId, seatMap[currentSeatId], 'webUser');
  }
}

// ============================================
// 座席描画
// ============================================
function renderSeats() {
  const seatList = document.getElementById("seatList");
  seatList.innerHTML = "";

  for (const [seatId, players] of Object.entries(seatMap)) {
    const seatDiv = document.createElement("div");
    seatDiv.className = "seat-box";
    seatDiv.dataset.seatid = seatId;

    // 状態別クラス
    if (players.length === 0) seatDiv.classList.add("seat-empty");
    else seatDiv.classList.add("seat-occupied");

    if (isRankingMode && seatId === currentRankingSeatId) seatDiv.classList.add("seat-ranking");

    seatDiv.innerHTML = `<strong>${seatId}</strong>`;

    players.forEach(playerId => {
      const p = playerData[playerId] || {};
      const entryDiv = document.createElement("div");
      entryDiv.className = "player-entry";
      entryDiv.innerHTML = `<strong>${playerId}</strong> Rate:${p.rate ?? 0} ${p.title ? `(${p.title})` : ""}`;
      
      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-button";
      removeBtn.textContent = "✖";
      removeBtn.addEventListener("click", () => {
        undoStack.push({ type:"removePlayer", seatId, playerId, index: seatMap[seatId].indexOf(playerId) });
        seatMap[seatId] = seatMap[seatId].filter(id => id !== playerId);
        if (seatMap[seatId].length === 0) delete seatMap[seatId];
        saveToLocalStorage();
        renderSeats();
      });

      entryDiv.appendChild(removeBtn);
      seatDiv.appendChild(entryDiv);
    });

    seatList.appendChild(seatDiv);
  }
}

// ============================================
// Undo / Redo
// ============================================
function saveAction(action) { undoStack.push(action); redoStack = []; }

function undoAction() {
  if (!undoStack.length) { displayMessage("元に戻す操作なし"); return; }
  const last = undoStack.pop();
  redoStack.push(last);

  switch (last.type) {
    case "addPlayer": seatMap[last.seatId] = seatMap[last.seatId].filter(p => p !== last.playerId); break;
    case "removePlayer": seatMap[last.seatId]?.splice(last.index, 0, last.playerId); break;
  }
  displayMessage("↩ 元に戻しました");
  saveToLocalStorage();
  renderSeats();
}

function redoAction() {
  if (!redoStack.length) { displayMessage("やり直しなし"); return; }
  const last = redoStack.pop();
  undoStack.push(last);

  switch (last.type) {
    case "addPlayer": seatMap[last.seatId] ??= []; seatMap[last.seatId].push(last.playerId); break;
    case "removePlayer": seatMap[last.seatId] = seatMap[last.seatId].filter(p => p !== last.playerId); break;
  }
  displayMessage("↪ やり直しました");
  saveToLocalStorage();
  renderSeats();
}

// ============================================
// ランキングモード
// ============================================
function handleRankingScan(decodedText) {
  const seatId = decodedText.trim();
  currentRankingSeatId = seatId;

  if (!seatMap[seatId] || seatMap[seatId].length === 0) {
    displayMessage("⚠️ プレイヤーが登録されていません");
    return;
  }

  const list = document.getElementById("rankingList");
  list.innerHTML = "";
  seatMap[seatId].forEach(pid => {
    const p = playerData[pid];
    const item = document.createElement("li");
    item.className = "draggable-item";
    item.draggable = true;
    item.dataset.id = pid;
    item.innerHTML = `<strong>${pid}</strong> Rate:${p.rate ?? 0} ${p.title ?? ""}`;
    list.appendChild(item);
  });

  enableDragSort("rankingList");
  displayMessage(`✅ 座席 ${seatId} のプレイヤーを読み込みました`);
}

function enableDragSort(listId) {
  const list = document.getElementById(listId);
  let dragged;
  list.querySelectorAll(".draggable-item").forEach(item => {
    item.addEventListener("dragstart", () => { dragged = item; item.classList.add("dragging"); });
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
    item.addEventListener("dragover", e => e.preventDefault());
    item.addEventListener("drop", e => {
      e.preventDefault();
      if (!dragged || dragged === item) return;
      const items = Array.from(list.children);
      const di = items.indexOf(dragged), ti = items.indexOf(item);
      list.insertBefore(dragged, di < ti ? item.nextSibling : item);
    });
  });
}

async function finalizeRanking() {
  const list = document.getElementById("rankingList");
  const rankedIds = Array.from(list.children).map(li => li.dataset.id);
  if (rankedIds.length < 2) { displayMessage("⚠️ 2人以上必要"); return; }

  // レート計算
  rankedIds.forEach((pid,i)=>{
    const p = playerData[pid];
    const diff = (p.lastRank ?? rankedIds.length) - (i+1);
    const point = diff*2;
    p.bonus = point; p.rate = Math.max(30, p.rate + point);
  });

  // タイトル更新
  const sorted = Object.entries(playerData).sort((a,b)=>b[1].rate-a[1].rate);
  sorted.slice(0,3).forEach(([pid], idx)=> playerData[pid].title=["👑王者","🥈挑戦者","🥉鬼気迫る者"][idx]);

  // 成功扱いとして結びつき解除
  if(currentRankingSeatId) { seatMap[currentRankingSeatId] = []; currentRankingSeatId=null; }
  saveToLocalStorage(); renderSeats();
  displayMessage("✅ ランキング確定・座席解除完了");
}

// ============================================
// GAS送信／読み込み
// ============================================
async function saveToGAS(seatMap, playerData) {
  const formData = new URLSearchParams();
  formData.append('secret', SECRET);
  formData.append('data', JSON.stringify({ seatMap, playerData }));
  try {
    const res = await fetch(GAS_URL, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: formData.toString() });
    console.log('GAS保存成功', await res.json());
  } catch(e){ console.error('GAS保存失敗', e);}
}

async function loadFromGAS() {
  try {
    const res = await fetch(GAS_URL, { method:'GET' });
    const json = await res.json();
    seatMap=json.seatMap||{}; playerData=json.playerData||{};
    renderSeats(); alert('GAS読み込み成功');
  } catch(e){ console.error('GAS読み込み失敗', e); alert('失敗'); }
}

// ============================================
// 送信関数
// ============================================
async function sendSeatData(tableID, playerIds, operator='webUser'){
  const formBody = new URLSearchParams({mode:'updatePlayers', tableID, players:JSON.stringify(playerIds), operator}).toString();
  fetch(gas_URL, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:formBody})
    .then(res=>res.json()).then(json=>console.log('送信結果',json)).catch(e=>console.error('送信失敗',e));
}

// ============================================
// CSVエクスポート
// ============================================
function toCSV(data, headers){
  const csvRows=[headers.join(",")];
  data.forEach(row=>{
    const vals=headers.map(h=>{ let v=row[h]??""; if(typeof v==="string"&&v.includes(",")) v=`"${v.replace(/"/g,'""')}"`; return v;});
    csvRows.push(vals.join(","));
  });
  return csvRows.join("\n");
}

function downloadCSV(csvText, filename){
  const blob=new Blob([csvText], {type:"text/csv;charset=utf-8;"}); 
  const url=URL.createObjectURL(blob); 
  const a=document.createElement("a"); 
  a.href=url; a.download=filename; a.style.display="none"; 
  document.body.appendChild(a); a.click(); document.body.removeChild(a); 
  URL.revokeObjectURL(url);
}

function exportPlayerCSV(){
  const players=[];
  Object.entries(seatMap).forEach(([seatID,playerList])=>playerList.forEach(pid=>players.push({playerID:pid, seatID, rate:playerData[pid]?.rate ?? 0})));
  if(players.length===0){alert("データなし"); return;}
  downloadCSV(toCSV(players, ["playerID","seatID","rate"]),"players.csv");
}

function exportSeatCSV(){
  const seatData=Object.entries(seatMap).map(([seatID,players])=>({seatID,players:players.join(";")}));
  if(seatData.length===0){alert("データなし"); return;}
  downloadCSV(toCSV(seatData, ["seatID","players"]),"seats.csv");
}

const leaveRecords=[
  {playerID:"player~0003", time:"2025-07-21 15:30", reason:"通信切断"},
  {playerID:"player~0010", time:"2025-07-22 18:45", reason:"トイレ離席"}
];

function exportLeaveCSV(){
  if(leaveRecords.length===0){alert("データなし"); return;}
  downloadCSV(toCSV(leaveRecords, ["playerID","time","reason"]),"leave_records.csv");
}

// ============================================
// 初期化
// ============================================
function bindButtons(){
  document.getElementById("undoBtn")?.addEventListener("click", undoAction);
  document.getElementById("redoBtn")?.addEventListener("click", redoAction);
  document.getElementById("exportPlayerBtn")?.addEventListener("click", exportPlayerCSV);
  document.getElementById("exportSeatBtn")?.addEventListener("click", exportSeatCSV);
  document.getElementById("exportLeaveBtn")?.addEventListener("click", exportLeaveCSV);
  document.getElementById("confirmRankingBtn")?.addEventListener("click", finalizeRanking);
  document.getElementById("saveToGASBtn")?.addEventListener("click", ()=>saveToGAS(seatMap, playerData));
  document.getElementById("loadFromGASBtn")?.addEventListener("click", loadFromGAS);
}

document.addEventListener("DOMContentLoaded", () => {
  loadFromLocalStorage();
  renderSeats();
  bindButtons();
});

// ============================================
// ローカルストレージ
// ============================================
function saveToLocalStorage(){
  localStorage.setItem("seatMap", JSON.stringify(seatMap));
  localStorage.setItem("playerData", JSON.stringify(playerData));
}

function loadFromLocalStorage(){
  try{ seatMap=JSON.parse(localStorage.getItem("seatMap")||"{}"); }catch(e){ seatMap={}; }
  try{ playerData=JSON.parse(localStorage.getItem("playerData")||"{}"); }catch(e){ playerData={}; }
  renderSeats();
}
