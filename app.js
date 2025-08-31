"use strict";

/* ===============================
   定数・設定
   =============================== */
const GAS_URL        = "https://script.google.com/macros/s/.../exec";   // 座席/プレイヤーデータ保存用
const GAS_USAGE_URL  = "https://script.google.com/macros/s/.../exec";   // 使用状況更新用
const ENDPOINT       = "https://script.google.com/macros/s/.../exec";   // 順位送信用
const SECRET         = 'kosen-brain-super-secret';
const SCAN_COOLDOWN_MS = 1500;
const MAX_PLAYERS_PER_SEAT = 6;
const ESP32_URL      = "http://esp32.local/led"; // ESP32のランプAPI

/* ===============================
   グローバル状態
   =============================== */
let seatMap           = {};    // { seatId: [playerId,...] }
let playerData        = {};    // { playerId: {nickname, rate, lastRank, bonus, title} }
let currentSeatId     = null;
let currentRankingSeatId = null;
let undoStack         = [];
let redoStack         = [];
let scanQr            = null;
let rankQr            = null;
let isScanCameraStarting = false;
let isRankCameraStarting = false;
let lastScannedText   = null;
let lastScanTime      = 0;
let isRankingMode     = false;
let msgTimer          = null;
let lastScrollTop     = 0;
let scrollTimeout     = null;

/* ===============================
   ユーティリティ
   =============================== */
const delay = ms => new Promise(res => setTimeout(res, ms));

function displayMessage(msg, duration = 3000) {
  const area = document.getElementById("messageArea");
  if (!area) return;
  area.textContent = msg;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => (area.textContent = ""), duration);
}

function downloadCSV(csvText, filename){
  const blob = new Blob([csvText], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV(data, headers) {
  const rows = [headers.join(",")];
  data.forEach(row => {
    const vals = headers.map(h=>{
      let v = row[h] ?? "";
      if(typeof v === "string" && v.includes(",")) v = `"${v.replace(/"/g,'""')}"`;
      return v;
    });
    rows.push(vals.join(","));
  });
  return rows.join("\n");
}

/* ===============================
   座席・プレイヤー管理
   =============================== */
function renderSeats() {
  const seatList = document.getElementById("seatList");
  if (!seatList) return;
  seatList.innerHTML = "";

  for (const [seatId, players] of Object.entries(seatMap)) {
    const seatDiv = document.createElement("div");
    seatDiv.className = "seat-box";
    seatDiv.innerHTML = `<strong>${seatId}</strong>`;

    players.forEach(playerId => {
      const p = playerData[playerId] || {};
      const entryDiv = document.createElement("div");
      entryDiv.className = "player-entry";
      entryDiv.innerHTML = `
        <div>
          <strong>${playerId}</strong>
          ${p.title ? `<span class="title-badge">${p.title}</span>` : ""}
          <span style="margin-left:10px;color:#888;">Rate: ${p.rate ?? 0}</span>
          <span class="rate-change ${p.bonus > 0 ? "rate-up" : p.bonus < 0 ? "rate-down" : "rate-zero"}">
            ${p.bonus > 0 ? "↑" : p.bonus < 0 ? "↓" : "±"}${Math.abs(p.bonus ?? 0)}
          </span>
        </div>
      `;

      const removeBtn = document.createElement("span");
      removeBtn.className = "remove-button";
      removeBtn.textContent = "✖";
      removeBtn.addEventListener("click", () => {
        undoStack.push({ type: "removePlayer", seatId, playerId, index: seatMap[seatId].indexOf(playerId) });
        seatMap[seatId] = seatMap[seatId].filter(id => id !== playerId);
        if(seatMap[seatId].length === 0) delete seatMap[seatId];
        saveToLocalStorage();
        renderSeats();
      });

      entryDiv.appendChild(removeBtn);
      seatDiv.appendChild(entryDiv);
    });
    seatList.appendChild(seatDiv);
  }
}

function removePlayer(seatId, playerId) {
  const idx = seatMap[seatId]?.indexOf(playerId);
  if (idx === -1) return;
  seatMap[seatId].splice(idx, 1);
  saveToLocalStorage();
  renderSeats();
}

/* ===============================
   Undo/Redo
   =============================== */
function saveAction(action) {
  undoStack.push(action);
  redoStack = [];
}

function undoAction() {
  if (!undoStack.length) { displayMessage("元に戻す操作がありません"); return; }
  const last = undoStack.pop();
  redoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId] = seatMap[last.seatId].filter(p=>p!==last.playerId); break;
    case "removePlayer": seatMap[last.seatId]?.splice(last.index,0,last.playerId); break;
  }
  displayMessage("↩ 元に戻しました");
  saveToLocalStorage();
  renderSeats();
}

function redoAction() {
  if (!redoStack.length) { displayMessage("やり直す操作がありません"); return; }
  const last = redoStack.pop();
  undoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId] = seatMap[last.seatId]||[]; seatMap[last.seatId].push(last.playerId); break;
    case "removePlayer": seatMap[last.seatId] = seatMap[last.seatId].filter(p=>p!==last.playerId); break;
  }
  displayMessage("↪ やり直しました");
  saveToLocalStorage();
  renderSeats();
}

/* ===============================
   QR読み取り
   =============================== */
function handleScanSuccess(decodedText) {
  const now = Date.now();
  if(decodedText===lastScannedText && now-lastScanTime<SCAN_COOLDOWN_MS) return;
  lastScannedText = decodedText;
  lastScanTime = now;

  if(decodedText.startsWith("table")) {
    currentSeatId = decodedText;
    seatMap[currentSeatId] ??= [];
    displayMessage(`✅ 座席セット: ${currentSeatId}`);
    if(isRankingMode) handleRankingScan(decodedText);
  }
  else if(decodedText.startsWith("player")){
    if(!currentSeatId){ displayMessage("⚠ 先に座席QRを読み込んでください"); return; }
    if(seatMap[currentSeatId].includes(decodedText)){ displayMessage("⚠ 既に登録済み"); return; }
    if(seatMap[currentSeatId].length>=MAX_PLAYERS_PER_SEAT){ displayMessage("⚠ この座席は6人まで"); return; }

    seatMap[currentSeatId].push(decodedText);
    playerData[decodedText] ??= { nickname: decodedText, rate:50, lastRank:null, bonus:0 };
    saveAction({ type:"addPlayer", seatId:currentSeatId, playerId:decodedText });
    saveToLocalStorage();
    renderSeats();
    sendSeatData(currentSeatId, seatMap[currentSeatId],'webUser');
    displayMessage(`✅ ${decodedText} 追加`);
  }
}

/* ===============================
   ランキング処理
   =============================== */
function handleRankingScan(seatId){
  currentRankingSeatId = seatId;
  if(!seatMap[seatId]){ displayMessage(`⚠️ 未登録の座席ID: ${seatId}`); return; }

  const playerIds = seatMap[seatId];
  if(playerIds.length===0){ displayMessage("⚠️ この座席にはプレイヤーが登録されていません"); return; }

  const list = document.getElementById("rankingList");
  list.innerHTML = "";
  playerIds.forEach(pid=>{
    const p = playerData[pid]||{};
    const item = document.createElement("li");
    item.className="draggable-item";
    item.draggable=true;
    item.dataset.id=pid;
    item.innerHTML=`<strong>${pid}</strong> ${p.title?`<span class="title-badge">${p.title}</span>`:""} <span class="rate">Rate:${p.rate??0}</span>`;
    list.appendChild(item);
  });
  enableDragSort("rankingList");
  displayMessage(`✅ 座席 ${seatId} のプレイヤーを読み込みました`);
}

function enableDragSort(listId){
  const list = document.getElementById(listId);
  let dragged;
  list.querySelectorAll(".draggable-item").forEach(item=>{
    item.addEventListener("dragstart",e=>{ dragged=item; item.classList.add("dragging"); });
    item.addEventListener("dragend",e=>{ item.classList.remove("dragging"); });
    item.addEventListener("dragover",e=>e.preventDefault());
    item.addEventListener("drop",e=>{
      e.preventDefault();
      if(dragged && dragged!==item){
        const items=[...list.children];
        const draggedIndex = items.indexOf(dragged);
        const dropIndex = items.indexOf(item);
        if(draggedIndex<dropIndex) list.insertBefore(dragged,item.nextSibling);
        else list.insertBefore(dragged,item);
      }
    });
  });
}

async function finalizeRanking(){
  const list = document.getElementById("rankingList");
  const rankedIds = Array.from(list.children).map(li=>li.dataset.id);
  if(rankedIds.length<2){ displayMessage("⚠️ 2人以上で順位を登録してください"); return; }

  calculateRate(rankedIds);
  const entries = rankedIds.map((pid,i)=>({playerId:pid, rank:i+1, rate:playerData[pid]?.rate??100}));
  const success = await postRankingUpdate(entries);
  if(!success){ displayMessage("❌ 順位の送信に失敗しました"); return; }

  saveToLocalStorage();
  if(currentRankingSeatId && seatMap[currentRankingSeatId]){
    seatMap[currentRankingSeatId]=[];
    renderSeats();
    list.innerHTML="";
    displayMessage(`✅ 順位を確定しました 座席 ${currentRankingSeatId} の結びつきを解除しました`);
    currentRankingSeatId=null;
  }
}

/* ===============================
   レート計算
   =============================== */
function calculateRate(rankedIds){
  rankedIds.forEach((pid,i)=>{
    const p=playerData[pid];
    const prevRank=p.lastRank??rankedIds.length;
    let diff = prevRank-(i+1);
    let point = diff*2;
    if(prevRank===1 && i===rankedIds.length-1) point=-8;
    if(prevRank===rankedIds.length && i===0) point=8;
    if(p.rate>=80) point=Math.floor(point*0.8);
    p.bonus = point;
    p.rate = Math.max(30,p.rate+point);
    p.lastRank = i+1;
  });
  assignTitles();
}

function assignTitles(){
  Object.values(playerData).forEach(p=>p.title=null);
  Object.entries(playerData).sort((a,b)=>b[1].rate-a[1].rate).slice(0,3).forEach(([pid],idx)=>{
    playerData[pid].title=["👑 王者","🥈 挑戦者","🥉 鬼気迫る者"][idx];
  });
}

/* ===============================
   ローカル保存 / GAS連携
   =============================== */
function saveToLocalStorage(){
  localStorage.setItem("seatMap",JSON.stringify(seatMap));
  localStorage.setItem("playerData",JSON.stringify(playerData));
}

function loadFromLocalStorage(){
  try{ seatMap=JSON.parse(localStorage.getItem("seatMap")||"{}"); } catch(e){ seatMap={}; }
  try{ playerData=JSON.parse(localStorage.getItem("playerData")||"{}"); } catch(e){ playerData={}; }
  renderSeats();
}

async function saveToGAS(seatMap,playerData){
  try{
    const res=await fetch(GAS_URL,{method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`secret=${SECRET}&data=${encodeURIComponent(JSON.stringify({seatMap,playerData}))}`});
    console.log(await res.json());
  } catch(err){ console.error('GAS保存失敗',err); }
}

async function loadFromGAS(){
  try{
    const res=await fetch(GAS_URL,{method:'GET'});
    const json = await res.json();
    seatMap=json.seatMap||{};
    playerData=json.playerData||{};
    renderSeats();
    alert("読み込み成功");
  } catch(err){ console.error(err); alert("読み込み失敗"); }
}

async function postRankingUpdate(entries){
  try{
    const lines=[`secret=${SECRET}`];
    entries.forEach(({playerId,rank,rate})=>lines.push([playerId,rank,rate].join(",")));
    const res = await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'text/plain'},body:lines.join("\n")});
    return (await res.text()).trim()==="ok";
  } catch(e){ console.error(e); return false; }
}

/* ===============================
   QRカメラ起動/停止
   =============================== */
async function startScanCamera(){ if(isScanCameraStarting) return; isScanCameraStarting=true;
  const el=document.getElementById("reader"); if(!el){ console.error("reader無し"); return; }
  scanQr=new Html5Qrcode("reader");
  await scanQr.start({facingMode:"environment"},{fps:10, qrbox:350},handleScanSuccess).catch(e=>console.error(e));
  isScanCameraStarting=false;
}

async function startRankCamera(){ if(isRankCameraStarting) return; isRankCameraStarting=true;
  const el=document.getElementById("rankingReader"); if(!el){ console.error("rankingReader無し"); return; }
  rankQr=new Html5Qrcode("rankingReader");
  await rankQr.start({facingMode:"environment"},{fps:10, qrbox:{width:200,height:200}}, decoded=>handleRankingScan(decoded)).catch(e=>console.error(e));
  isRankCameraStarting=false;
}

async function stopScanCamera(){ if(scanQr){ await scanQr.stop(); await scanQr.clear(); scanQr=null; } }
async function stopRankCamera(){ if(rankQr){ await rankQr.stop(); await rankQr.clear(); rankQr=null; } }

/* ===============================
   CSV出力
   =============================== */
function exportPlayerCSV(){
  const data=[]; Object.entries(seatMap).forEach(([seatID,players])=>players.forEach(pid=>data.push({playerID:pid,seatID,rate:playerData[pid]?.rate??0})));
  if(data.length===0){ alert("生徒データなし"); return; }
  downloadCSV(toCSV(data,["playerID","seatID","rate"]),"players.csv");
}

function exportSeatCSV(){
  const data=Object.entries(seatMap).map(([seatID,players])=>({seatID,players:players.join(";")}));
  if(data.length===0){ alert("座席データなし"); return; }
  downloadCSV(toCSV(data,["seatID","players"]),"seats.csv");
}

/* ===============================
   初期化
   =============================== */
document.addEventListener("DOMContentLoaded",()=>{
  loadFromLocalStorage();
  renderSeats();
  document.getElementById("undoBtn")?.addEventListener("click",undoAction);
  document.getElementById("redoBtn")?.addEventListener("click",redoAction);
  document.getElementById("exportPlayerBtn")?.addEventListener("click",exportPlayerCSV);
  document.getElementById("exportSeatBtn")?.addEventListener("click",exportSeatCSV);
  document.getElementById("saveToGASBtn")?.addEventListener("click",()=>saveToGAS(seatMap,playerData));
  document.getElementById("loadFromGASBtn")?.addEventListener("click",loadFromGAS);
  document.getElementById("confirmRankingBtn")?.addEventListener("click",finalizeRanking);
});
