// ==============================================
// 座席・プレイヤー管理システム JS 完全版
// ==============================================

// --- 定数・設定 ---
const GAS_URL_SEAT       = "https://script.google.com/macros/s/AKfycbygpqW4VYNm__Wip39CwAwoyitrTi4CPAg4N6lH7WPOPkcU37LbzS2XiNn-xvWzEI84/exec";
const GAS_URL_PLAYERS    = "https://script.google.com/macros/s/AKfycbzPUOz4eCsZ7RVm4Yf_VPu1OC5nn2yIOPa5U-tT7ZMHpw0FRNsHaqovbX7vSaEHjPc/exec";
const ENDPOINT_RANKING   = "https://script.google.com/macros/s/AKfycbyhvqBiHIAsVYfUDw5e3Bz6L83OkwuZEFL-YCFHCNBi7MrUb7zQx1EV1RxZKTD62QED/exec";
const SECRET             = "kosen-brain-super-secret";
const SCAN_COOLDOWN_MS   = 1500;
const MAX_PLAYERS_PER_SEAT = 6;

// --- 状態管理 ---
let seatMap        = {}; // { seatID: [playerID,...] }
let playerData     = {}; // { playerID: { nickname, rate, lastRank, bonus, title } }
let actionHistory  = [];
let undoStack      = [];
let redoStack      = [];
let leaveRecords   = [];
let douTakuRecords = [];

let currentSeatId       = null;
let currentRankingSeatId= null;
let lastScannedText     = null;
let lastScanTime        = 0;

let isRankingMode       = false;
let scanQr              = null;
let rankQr              = null;
let isScanCameraStarting= false;
let isRankCameraStarting= false;
let msgTimer            = null;

// --- ユーティリティ ---
const delay = ms => new Promise(res => setTimeout(res, ms));

function displayMessage(msg){
  const area = document.getElementById("messageArea");
  if(!area) return;
  area.textContent = msg;
  clearTimeout(msgTimer);
  msgTimer = setTimeout(()=> area.textContent="",3000);
}

function toCSV(data, headers){
  const csvRows = [headers.join(",")];
  data.forEach(row=>{
    const vals = headers.map(h=>{
      let v=row[h]??"";
      if(typeof v==="string" && v.includes(",")) v=`"${v.replace(/"/g,'""')}"`;
      return v;
    });
    csvRows.push(vals.join(","));
  });
  return csvRows.join("\n");
}

function downloadCSV(csvText, filename){
  const blob = new Blob([csvText], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display="none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- ローカル保存 ---
function saveToLocalStorage(){
  localStorage.setItem("seatMap", JSON.stringify(seatMap));
  localStorage.setItem("playerData", JSON.stringify(playerData));
  localStorage.setItem("leaveRecords", JSON.stringify(leaveRecords));
  localStorage.setItem("douTakuRecords", JSON.stringify(douTakuRecords));
}
function loadFromLocalStorage(){
  seatMap = JSON.parse(localStorage.getItem("seatMap")||"{}");
  playerData = JSON.parse(localStorage.getItem("playerData")||"{}");
  leaveRecords = JSON.parse(localStorage.getItem("leaveRecords")||"[]");
  douTakuRecords = JSON.parse(localStorage.getItem("douTakuRecords")||"[]");
  renderSeats();
}

// --- アクション履歴 ---
function saveAction(action){ undoStack.push(action); redoStack=[]; }
function undoAction(){
  if(!undoStack.length){ displayMessage("元に戻す操作がありません"); return; }
  const last = undoStack.pop(); redoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId] = seatMap[last.seatId].filter(p=>p!==last.playerId); break;
    case "removePlayer": seatMap[last.seatId]?.splice(last.index,0,last.playerId); break;
    case "removeSeat": seatMap[last.seatId]=last.players; break;
  }
  displayMessage("↩ 元に戻しました");
  saveToLocalStorage();
  renderSeats();
}
function redoAction(){
  if(!redoStack.length){ displayMessage("やり直す操作がありません"); return; }
  const last = redoStack.pop(); undoStack.push(last);
  switch(last.type){
    case "addPlayer": seatMap[last.seatId]??=[]; seatMap[last.seatId].push(last.playerId); break;
    case "removePlayer": seatMap[last.seatId]=seatMap[last.seatId].filter(p=>p!==last.playerId); break;
    case "removeSeat": delete seatMap[last.seatId]; break;
  }
  displayMessage("↪ やり直しました");
  saveToLocalStorage();
  renderSeats();
}

// --- 座席描画 ---
function renderSeats(){
  const seatList = document.getElementById("seatList");
  if(!seatList) return;
  seatList.innerHTML="";
  Object.entries(seatMap).forEach(([seatId,players])=>{
    const seatDiv = document.createElement("div");
    seatDiv.className="seat-box";
    seatDiv.innerHTML=`<strong>${seatId}</strong>`;
    players.forEach(playerId=>{
      const p = playerData[playerId]||{};
      const entryDiv = document.createElement("div");
      entryDiv.className="player-entry";
      entryDiv.innerHTML = `<strong>${playerId}</strong> Rate:${p.rate??0} Bonus:${p.bonus??0}`;
      const removeBtn = document.createElement("span");
      removeBtn.textContent="✖"; removeBtn.className="remove-button";
      removeBtn.addEventListener("click",()=>{
        undoStack.push({type:"removePlayer",seatId,playerId,index:seatMap[seatId].indexOf(playerId)});
        seatMap[seatId] = seatMap[seatId].filter(id=>id!==playerId);
        if(seatMap[seatId].length===0) delete seatMap[seatId];
        saveToLocalStorage();
        renderSeats();
      });
      entryDiv.appendChild(removeBtn);
      seatDiv.appendChild(entryDiv);
    });
    seatList.appendChild(seatDiv);
  });
}

// --- QRスキャン処理 ---
function handleScanSuccess(decodedText){
  const now = Date.now();
  if(decodedText===lastScannedText && now-lastScanTime<SCAN_COOLDOWN_MS) return;
  lastScannedText=decodedText; lastScanTime=now;

  if(decodedText.startsWith("table")){
    currentSeatId = decodedText;
    seatMap[currentSeatId]??=[];
    displayMessage(`✅ 座席セット: ${currentSeatId}`);
    if(isRankingMode) handleRankingScan(decodedText);

  } else if(decodedText.startsWith("player")){
    if(!currentSeatId){ displayMessage("⚠ 先に座席QRを読み込んでください"); return; }
    if(seatMap[currentSeatId].includes(decodedText)){ displayMessage("⚠ 既に登録済み"); return; }
    if(seatMap[currentSeatId].length>=MAX_PLAYERS_PER_SEAT){ displayMessage(`⚠ この座席は${MAX_PLAYERS_PER_SEAT}人まで`); return; }

    seatMap[currentSeatId].push(decodedText);
    playerData[decodedText]??={nickname:decodedText,rate:50,lastRank:null,bonus:0};
    saveAction({type:"addPlayer",seatId:currentSeatId,playerId:decodedText});
    displayMessage(`✅ ${decodedText} 追加`);
    saveToLocalStorage();
    renderSeats();
    sendSeatData(currentSeatId,seatMap[currentSeatId],"webUser");
  }
}

// --- ランキング ---
function handleRankingScan(seatId){
  currentRankingSeatId=seatId;
  if(!seatMap[seatId]){ displayMessage(`⚠️ 未登録座席ID: ${seatId}`); return; }
  const list=document.getElementById("rankingList"); list.innerHTML="";
  seatMap[seatId].forEach(pid=>{
    const p = playerData[pid]||{};
    const li=document.createElement("li");
    li.className="draggable-item"; li.draggable=true; li.dataset.id=pid;
    li.textContent=`${pid} Rate:${p.rate}`;
    list.appendChild(li);
  });
  enableDragSort("rankingList");
  displayMessage(`✅ 座席 ${seatId} のプレイヤー読み込み完了`);
}

function enableDragSort(listId){
  const list=document.getElementById(listId); let dragged;
  list.querySelectorAll(".draggable-item").forEach(item=>{
    item.addEventListener("dragstart",()=>{ dragged=item; item.classList.add("dragging"); });
    item.addEventListener("dragend",()=>item.classList.remove("dragging"));
    item.addEventListener("dragover",e=>e.preventDefault());
    item.addEventListener("drop",e=>{
      e.preventDefault();
      if(dragged && dragged!==item){
        const items=Array.from(list.children);
        const di=items.indexOf(dragged), ii=items.indexOf(item);
        if(di<ii) list.insertBefore(dragged,item.nextSibling); else list.insertBefore(dragged,item);
      }
    });
  });
}

async function finalizeRanking(){
  const list=document.getElementById("rankingList");
  const rankedIds=Array.from(list.children).map(li=>li.dataset.id);
  if(rankedIds.length<2){ displayMessage("⚠️ 2人以上で順位登録してください"); return; }

  rankedIds.forEach((pid,i)=>{
    const p = playerData[pid];
    const prev=p.lastRank??rankedIds.length;
    let diff=prev-(i+1), point=diff*2;
    if(prev===1 && i===rankedIds.length-1) point=-8;
    if(prev===rankedIds.length && i===0) point=8;
    if(p.rate>=80) point=Math.floor(point*0.8);
    p.bonus=point; p.rate=Math.max(30,p.rate+point); p.lastRank=i+1;
  });

  const lines=[`secret=${SECRET}`];
  rankedIds.forEach(pid=>lines.push([pid,playerData[pid].lastRank,playerData[pid].rate].join(",")));
  await fetch(ENDPOINT_RANKING,{method:"POST",headers:{"Content-Type":"text/plain"},body:lines.join("\n")});

  if(currentRankingSeatId && seatMap[currentRankingSeatId]) seatMap[currentRankingSeatId]=[];
  currentRankingSeatId=null;
  saveToLocalStorage();
  renderSeats();
  displayMessage("✅ 順位確定完了");
}

// --- GAS通信 ---
async function sendSeatData(seatID,playerIDs,operator="webUser"){
  const postData = new URLSearchParams({mode:"updatePlayers",tableID:seatID,players:JSON.stringify(playerIDs),operator}).toString();
  fetch(GAS_URL_PLAYERS,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:postData})
    .then(r=>r.json()).then(json=>console.log("送信結果:",json)).catch(e=>console.error("送信失敗:",e));
}

// --- CSVエクスポート ---
function exportPlayerCSV(){
  const players=[];
  Object.entries(seatMap).forEach(([seatID,playerList])=>{
    playerList.forEach(playerID=>players.push({playerID,seatID,rate:playerData[playerID]?.rate??0}));
  });
  if(!players.length) return alert("エクスポートする生徒データがありません。");
  downloadCSV(toCSV(players,["playerID","seatID","rate"]),"players.csv");
}

function exportSeatCSV(){
  const seatData=Object.entries(seatMap).map(([seatID,players])=>({seatID,players:players.join(";")}));
  if(!seatData.length) return alert("エクスポートする座席データがありません。");
  downloadCSV(toCSV(seatData,["seatID","players"]),"seats.csv");
}

function exportLeaveCSV(){
  if(!leaveRecords.length) return alert("離席データがありません");
  downloadCSV(toCSV(leaveRecords,["playerID","time","reason"]),"leave_records.csv");
}

function exportRankingCSV(){
  const rankingData=[];
  Object.entries(playerData).forEach(([pid,p])=>{
    if(p.lastRank!==null) rankingData.push({playerID:pid,rank:p.lastRank,rate:p.rate});
  });
  if(!rankingData.length) return alert("ランキングデータがありません");
  downloadCSV(toCSV(rankingData,["playerID","rank","rate"]),"ranking.csv");
}

// --- QRカメラ操作 ---
async function startScanCamera(){ if(isScanCameraStarting) return; isScanCameraStarting=true;
  scanQr=new Html5Qrcode("reader");
  await scanQr.start({facingMode:"environment"},{fps:10,qrbox:350},handleScanSuccess);
  console.log("✅ プレイヤーカメラ起動"); isScanCameraStarting=false;
}
async function stopScanCamera(){ if(scanQr){ await scanQr.stop(); await scanQr.clear(); scanQr=null; console.log("🛑 プレイヤーカメラ停止"); } }
async function startRankCamera(){ if(isRankCameraStarting) return; isRankCameraStarting=true;
  rankQr=new Html5Qrcode("rankingReader");
  await rankQr.start({facingMode:"environment"},{fps:10,qrbox:{width:200,height:200}},handleRankingScan);
  console.log("✅ 順位登録カメラ起動"); isRankCameraStarting=false;
}
async function stopRankCamera(){ if(rankQr){ await rankQr.stop(); await rankQr.clear(); rankQr=null; console.log("🛑 順位登録カメラ停止"); } }

// --- 初期化 ---
document.addEventListener("DOMContentLoaded",()=>{
  loadFromLocalStorage();
  document.getElementById("undoBtn")?.addEventListener("click",undoAction);
  document.getElementById("redoBtn")?.addEventListener("click",redoAction);
  document.getElementById("exportPlayerBtn")?.addEventListener("click",exportPlayerCSV);
  document.getElementById("exportSeatBtn")?.addEventListener("click",exportSeatCSV);
  document.getElementById("exportLeaveBtn")?.addEventListener("click",exportLeaveCSV);
  document.getElementById("exportRankingBtn")?.addEventListener("click",exportRankingCSV);
  document.getElementById("confirmRankingBtn")?.addEventListener("click",finalizeRanking);
});
