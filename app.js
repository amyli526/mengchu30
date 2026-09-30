// ===================== 状态（进度 = 本地保存） =====================
const K = "mengchu30_v2";
const TOTAL_DAYS = 30;
let S = { done: {}, mood: {}, welcomed: false };
try {
  const raw = JSON.parse(localStorage.getItem(K) || localStorage.getItem("mengchu30_v1") || "{}");
  S = Object.assign(S, raw && typeof raw === "object" ? raw : {});
  if (!S.done || typeof S.done !== "object") S.done = {};
  if (!S.mood || typeof S.mood !== "object") S.mood = {};
} catch (e) { /* 本地存储损坏时用默认值 */ }
function save() { try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) {} }

const PHRASES = ["listen", "speak", "read", "write", "play"];
const PHRASE_NAMES = { listen: "听一听", speak: "说一说", read: "读一读", write: "写一写", play: "玩一玩" };

// ===================== 工具 =====================
function $(id) { return document.getElementById(id); }
function clearOverlays() { document.querySelectorAll(".overlay").forEach(o => o.remove()); }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function toast(msg) {
  const t = $("toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2000);
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function confetti() {
  const colors = ["#FF8FAB", "#FFB4A2", "#A8E6CF", "#B8A7FF", "#FFD97D"];
  for (let i = 0; i < 26; i++) {
    const d = document.createElement("div"); d.className = "confetti";
    d.style.left = (Math.random() * 100) + "vw";
    d.style.background = colors[i % colors.length];
    document.body.appendChild(d);
    const dx = (Math.random() - .5) * 180, dy = 200 + Math.random() * 340, r = 720 + Math.random() * 540;
    if (d.animate) {
      d.animate(
        [{ transform: "translate(0,0) rotate(0deg)", opacity: 1 },
         { transform: "translate(" + dx + "px," + dy + "px) rotate(" + r + "deg)", opacity: 0 }],
        { duration: 1100, easing: "cubic-bezier(.2,.6,.4,1)" }
      ).onfinish = () => d.remove();
    }
    setTimeout(() => { if (d.isConnected) d.remove(); }, 1500);
  }
}
function cheer(msg) { toast(msg); }

// ===================== 舞台缩放（iPad 横屏铺满） =====================
const STAGE_W = 1024, STAGE_H = 768;
function fitStage() {
  const st = $("stage"); if (!st) return;
  const pad = window.innerWidth < 700 ? 0 : 0;
  const s = Math.min((window.innerWidth - pad) / STAGE_W, (window.innerHeight - pad) / STAGE_H);
  st.style.transform = "scale(" + s + ")";
}
window.addEventListener("resize", fitStage);
window.addEventListener("orientationchange", () => setTimeout(fitStage, 120));

// ===================== 语音朗读（Web Speech API） =====================
let voicesCache = [];
function loadVoices() { try { voicesCache = window.speechSynthesis.getVoices() || []; } catch (e) { voicesCache = []; } }
if ("speechSynthesis" in window) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }
const ZH_FEMALE = [/xiaoxiao/i, /yaoyao/i, /yuhan/i, /huihui/i, /meijia/i, /xiaoyi/i, /ting-?ting/i, /mei-?mei/i, /xiaomei/i, /kaili/i, /hanhan/i, /shuangshuang/i, /婷婷/i, /小霞/i, /慧慧/i, /晓晓/i, /盼盼/i];
function pickZh() {
  const zh = voicesCache.filter(v => /^(zh|cmn)/i.test(v.lang || ""));
  if (!zh.length) return null;
  const score = v =>
    ((v.localService ? 0 : 12)) +
    (/natural|在线|自然|online|网络/i.test(v.name) ? 18 : 0) +
    (/zh[-_]CN/i.test(v.lang) ? 8 : 0) +
    (ZH_FEMALE.some(r => r.test(v.name)) ? 30 : 0);
  return zh.slice().sort((a, b) => score(b) - score(a))[0] || null;
}
function speechOK() { return "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function"; }
function speak(text) {
  if (!text) return;
  if (!speechOK()) { toast("此浏览器不支持语音，请用 Safari 或 Chrome 打开哦"); return; }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = "zh-CN";
    const v = pickZh(); if (v) u.voice = v;
    u.rate = 0.82; u.pitch = 1.1; u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch (e) { /* 某些浏览器首次调用会抛错，忽略即可 */ }
}
function speakStory() {
  const d = DAY_DATA[CUR]; if (!d) return;
  speak(d.story.map(l => l.t).join("。"));
}

// ===================== 地图 / 首页 =====================
function doneList() { return S.done[CUR] || []; }
function doneDay(n) { const a = S.done[n]; return !!a && a.length >= PHRASES.length; }
function dayStatus(n) {
  if (n > TOTAL_DAYS) return "locked";
  if (doneDay(n)) return "done";
  if (n === 1) return "today";
  if (doneDay(n - 1)) return "today";
  return "locked";
}
function renderHome() {
  const map = $("home-map"); if (!map) return;
  map.innerHTML = "";
  for (let i = 1; i <= TOTAL_DAYS; i++) {
    const st = dayStatus(i);
    const t = THEMES[i - 1] || ["", "", "⭐️"];
    const el = document.createElement("div");
    el.className = "dayitem " + st;
    el.title = "第" + i + "天 · " + t[0];
    const dImg = DAY_DATA[i] && DAY_DATA[i].img;
    if (st === "done") el.innerHTML = '<div class="stamp">🌸</div>';
    else if (st === "locked") el.innerHTML = '<div class="ico">🔒</div><div class="num">' + i + '</div>';
    else if (dImg) el.innerHTML = '<img class="day-thumb" src="' + dImg + '" alt=""><div class="num">' + i + '</div>';
    else el.innerHTML = '<div class="ico">' + t[2] + '</div><div class="num">' + i + '</div>' +
      '<div class="sub">' + esc(t[0]) + '</div>';
    el.onclick = () => {
      if (st === "locked") { toast("完成「第" + (i - 1) + "天」就能解锁这一天啦 🔑"); return; }
      openDay(i);
    };
    map.appendChild(el);
  }
  const cnt = Object.keys(S.done).filter(k => doneDay(k)).length;
  $("home-count").textContent = "已完成 " + cnt + " / " + TOTAL_DAYS + " 天";
  $("home-progress").style.width = (cnt / TOTAL_DAYS * 100) + "%";
}

// ===================== 打开某一天 =====================
let CUR = 1;
let curPanel = "listen";
let dayReady = false;

function openDay(n) {
  n = Math.max(1, Math.min(TOTAL_DAYS, n | 0));
  if (n > 1 && !doneDay(n - 1)) { toast("先完成第" + (n - 1) + "天哦 🔑"); return; }
  const d = DAY_DATA[n];
  if (!d) { toast("这一天的内容还在准备中，很快就来～"); return; }

  CUR = n;
  Object.keys(recBlobs).forEach(revokeBlob);
  stopRecord();
  celebrating = false;   // 每天的庆祝只触发一次，切天后重置

  $("screen-home").classList.add("hidden");
  $("screen-day").classList.remove("hidden");
  $("day-title").textContent = "第" + n + "天";
  $("day-chip").textContent = "第 " + n + " 天";
  $("day-emoji").innerHTML = d.img
    ? '<img class="day-emoji-img" src="' + d.img + '" alt="' + esc(d.title) + '">'
    : esc(d.emoji);
  $("day-name").textContent = d.title;
  $("day-sub").textContent = d.sub;
  $("side-words").innerHTML = d.vocab.map(v =>
    '<div class="wc">' + esc(v.char) + '<i>' + esc(v.py) + '</i></div>').join("");
  $("day-craft").textContent = d.craft;

  // 每天重新初始化各环节状态
  threeInit(); renderTrace(); renderMatch(); renderQuiz();

  renderTabs(); renderListen(); renderSpeak();
  showPanel("listen");
  renderSideProgress();
  fitStage();
  if (S.mood[n] === undefined && !(S.done[n] && S.done[n].length)) moodGreet(n);
}

function goHome() {
  stopRecord();
  Object.keys(recBlobs).forEach(revokeBlob);
  clearOverlays();
  $("screen-day").classList.add("hidden");
  $("screen-home").classList.remove("hidden");
  renderHome();
  fitStage();
}

function openNextDay() {
  if (!doneDay(CUR)) { toast("先完成今天 5 个环节，再开启下一天 🔑"); return; }
  if (CUR >= TOTAL_DAYS) { showFinale(); return; }
  openDay(CUR + 1);
}

function renderTabs() {
  const done = doneList();
  document.querySelectorAll("#day-tabs .tab").forEach(tab => {
    const p = tab.getAttribute("data-p");
    tab.classList.toggle("done", done.indexOf(p) >= 0);
    tab.classList.toggle("active", p === curPanel);
  });
}
function renderSideProgress() {
  const n = doneList().filter(p => PHRASES.indexOf(p) >= 0).length;
  const bar = $("side-progress-bar"); if (bar) bar.style.width = (n / PHRASES.length * 100) + "%";
  const txt = $("side-progress-txt"); if (txt) txt.textContent = "已完成 " + n + " / 5 个环节";
  const nb = $("next-day-btn");
  if (nb) nb.style.display = doneDay(CUR) ? "block" : "none";
}
function showPanel(p) {
  curPanel = p;
  document.querySelectorAll(".panel").forEach(el => el.classList.remove("active"));
  const el = $("panel-" + p);
  if (el) el.classList.add("active");
  document.querySelectorAll("#day-tabs .tab").forEach(t =>
    t.classList.toggle("active", t.getAttribute("data-p") === p));
  const main = document.querySelector(".day-main");
  if (main) main.scrollTop = 0;
}

function doneListen() { markDone("listen"); speak("太棒了，故事听完了！"); toast("听一听完成！👂"); }
function doneSpeak() { stopRecord(); markDone("speak"); speak("你说得真好听！"); toast("说一说完成！🗣️"); }
function doneRead() { markDone("read"); toast("读一读完成！生字宝宝都是你的好朋友啦 📖"); }

let celebrating = false;
function markDone(phrase) {
  S.done[CUR] = S.done[CUR] || [];
  if (S.done[CUR].indexOf(phrase) < 0) S.done[CUR].push(phrase);
  save();
  renderTabs(); renderSideProgress();
  if (PHRASES.every(p => S.done[CUR].indexOf(p) >= 0) && !celebrating) {
    celebrating = true;
    setTimeout(() => {
      confetti();
      clearOverlays();
      const d = DAY_DATA[CUR];
      const isLast = CUR >= TOTAL_DAYS;
      const ov = document.createElement("div"); ov.className = "overlay";
      ov.innerHTML =
        '<div class="modal"><div class="big">' + esc(d.emoji) + '</div>' +
        '<h2>第' + CUR + '天完成啦！</h2>' +
        '<p>' + (isLast ? "三十天全部通关！兔兔给你戴上学士帽 🎓" : "送你一朵小花花 🌸 明天我们继续探险～") + '</p>' +
        '<button onclick="closeOverlay(this)">' + (isLast ? "🎓 看看毕业庆祝" : "回地图看看 🗺️") + '</button>' +
        (isLast ? '' : '<div style="margin-top:8px"><button class="ghost" onclick="closeOverlay(this);openNextDay()">⏭️ 直接开启第' + (CUR + 1) + '天</button></div>') +
        '</div>';
      document.body.appendChild(ov);
    }, 400);
  }
}
function closeOverlay(btn) { const o = btn && btn.closest(".overlay"); if (o) o.remove(); }

// ===================== 听一听 =====================
function renderListen() {
  const d = DAY_DATA[CUR]; if (!d) return;
  const sv = d.story.map(l =>
    '<span class="line">' + esc(l.t) + '<span class="py">' + esc(l.py) + '</span></span>').join("");
  const img = d.img ? '<img class="story-img" src="' + d.img + '" alt="' + esc(d.title) + '">' : "";
  const box = $("listen-story");
  box.className = "story-text" + (d.story.length > 6 ? " compact" : "") + (d.story.length >= 8 ? " tiny" : "");
  box.innerHTML = img + sv;
  $("listen-moral").textContent = d.moral;
  $("listen-craft").textContent = d.craft;
  $("listen-parent").textContent = d.parent;
  $("listen-rhyme").innerHTML = d.rhymelines.map(line =>
    '<div class="speak-line"><span class="txt">' + esc(line) + '</span>' +
    '<div class="sbtns"><button class="speaker" onclick="speak(this.dataset.t)" data-t="' + esc(line) + '">🔊</button></div></div>'
  ).join("");
}

// ===================== 说一说（录音） =====================
let recState = { on: false, idx: -1, rec: null, chunks: [], stream: null };
let recBlobs = {};
let replayAu = null;
function revokeBlob(idx) {
  if (recBlobs[idx]) { try { URL.revokeObjectURL(recBlobs[idx]); } catch (e) {} delete recBlobs[idx]; }
}
function stopReplay() { if (replayAu) { try { replayAu.pause(); } catch (e) {} replayAu = null; } }
function stopRecord() {
  if (!recState.on) return;
  recState.on = false;
  const r = recState.rec;
  try { if (r && r.state !== "inactive") r.stop(); } catch (e) {}
  syncRecBtn();
}
function startRecord(idx) {
  if (recState.on) { if (recState.idx === idx) { stopRecord(); return; } stopRecord(); }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("此浏览器不支持录音哦"); return; }
  stopReplay();
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    const local = { idx: idx, chunks: [], stream: stream, rec: null, on: true };
    let rec;
    try {
      const types = ["audio/webm", "audio/mp4", "audio/ogg"];
      const mime = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) { try { stream.getTracks().forEach(t => t.stop()); } catch (e2) {} toast("这个浏览器不能录音哦"); return; }
    local.rec = rec;
    recState = local;
    rec.ondataavailable = e => { if (e.data && e.data.size) local.chunks.push(e.data); };
    rec.onstop = () => {
      try { stream.getTracks().forEach(t => t.stop()); } catch (e) {}
      if (recState === local) recState = { on: false, idx: -1, rec: null, chunks: [], stream: null };
      const type = (rec.mimeType || "audio/webm");
      const blob = new Blob(local.chunks, { type: type });
      revokeBlob(idx);
      recBlobs[idx] = URL.createObjectURL(blob);
      const box = $("audioBox-" + idx);
      if (box) {
        box.innerHTML = '<audio controls src="' + recBlobs[idx] + '"></audio>' +
          '<button class="mic" onclick="speakReplay(' + idx + ')">🐰 再听听</button>';
      }
      syncRecBtn();
    };
    try { rec.start(); } catch (e) { toast("录音启动失败，请重试"); return; }
    syncRecBtn();
    const line = $("speak-line-" + idx);
    if (line && line.scrollIntoView) line.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }).catch(() => toast("请允许使用麦克风哦 🎤"));
}
function speakReplay(idx) {
  const a = recBlobs[idx];
  if (!a) return;
  stopReplay();
  if ("speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  const au = new Audio(a);
  replayAu = au;
  au.onended = () => { if (replayAu === au) replayAu = null; };
  const p = au.play();
  if (p && p.catch) p.catch(() => toast("点一下就能播放啦 🔊"));
}
function syncRecBtn() {
  document.querySelectorAll("[data-mic]").forEach(b => {
    const idx = +b.getAttribute("data-mic");
    const isRec = recState.on && recState.idx === idx;
    b.classList.toggle("recording", isRec);
    b.textContent = isRec ? "⏹ 保存" : (recBlobs[idx] ? "🎤 重录" : "🎤 录下来");
  });
}
function renderSpeak() {
  const d = DAY_DATA[CUR]; if (!d) return;
  $("speak-list").innerHTML = d.speak.map((line, i) => {
    const txt = (typeof line === "string") ? line : line.t;
    const img = (line && typeof line === "object" && line.img) ? line.img : "";
    const photo = img ? '<img class="speak-photo" src="' + img + '" alt="">' : "";
    return '<div class="speak-line" id="speak-line-' + i + '">' + photo +
      '<div class="speak-main"><span class="txt">' + esc(txt) + '</span>' +
      '<div class="sbtns">' +
      '<button class="speaker" onclick="speak(this.dataset.t)" data-t="' + esc(txt) + '">🔊</button>' +
      '<button class="mic" data-mic="' + i + '" onclick="startRecord(' + i + ')">🎤 录下来</button>' +
      '</div></div><div id="audioBox-' + i + '" style="width:100%;display:flex;gap:8px;margin-top:6px"></div></div>';
  }).join("");
  syncRecBtn();
}

// ===================== 读一读：蒙氏三段式 =====================
let thr = { step: 1, i: 0, opted: [] };
function threeInit() {
  const d = DAY_DATA[CUR]; if (!d) return;
  thr = { step: 1, i: 0, opted: shuffle(d.vocab.map((v, k) => k)) };
  threeStage(true);
}
function threeStage(silent) {
  const d = DAY_DATA[CUR]; if (!d) return;
  const v = d.vocab;
  const hint = $("three-hint"), body = $("three-body"), ctl = $("three-ctl");
  if (!hint || !body || !ctl) return;
  const vocabImg = it => v[it].img
    ? '<img class="vocab-img" src="' + v[it].img + '" alt="">'
    : '<div class="emoji-lg">' + esc(v[it].emoji) + '</div>';

  if (thr.step === 1) { // 命名
    const it = thr.opted[thr.i];
    hint.textContent = "第1段·命名：这是图字卡，跟着兔兔读";
    body.innerHTML =
      '<div class="three-card">' + vocabImg(it) +
      '<div class="char-lg">' + esc(v[it].char) + '</div>' +
      '<div class="pylg">' + esc(v[it].py) + '</div>' +
      '<div class="word-sm">' + esc(v[it].word) + '</div></div>';
    if (!silent) speak(v[it].char + "，" + v[it].word);
    ctl.innerHTML =
      '<button class="ghost" onclick="speak(DAY_DATA[CUR].vocab[' + it + '].char)">🔊 再听</button>' +
      (thr.i < v.length - 1
        ? '<button onclick="thr.i++;threeStage()">下一个 ➡️</button>'
        : '<button onclick="thr.step=2;thr.i=0;threeStage()">到第2段啦 🌟</button>');
  } else if (thr.step === 2) { // 辨别
    const it = thr.opted[thr.i], target = v[it];
    hint.textContent = "第2段·辨别：请把「" + target.char + "」指给我看！";
    const opts = shuffle(v.map((o, k) => k));
    body.innerHTML =
      '<div style="margin-bottom:10px"><div class="three-card three-card-sm">' + vocabImg(it) +
      '<div class="pylg">找一找：' + esc(target.char) + '</div></div></div>' +
'<div class="pair-grid">' + opts.map(k =>
        '<div class="vocab-cell vocab-cell-img" data-k="' + k + '" onclick="threePick(this,' + k + ')">' +
        (v[k].img ? '<img src="' + v[k].img + '" alt="">' : '<div class="emoji-lg">' + esc(v[k].emoji) + '</div>') +
        '</div>').join("") + '</div>';
    ctl.innerHTML = '<button class="ghost" onclick="speak(this.dataset.t)" data-t="' + esc("请把" + target.char + "指给我看") + '">🔊 提示</button>';
  } else { // 回忆
    const it = thr.opted[thr.i];
    hint.textContent = "第3段·回忆：这是谁？它的字宝宝在哪里？";
    body.innerHTML =
      '<div style="margin-bottom:10px"><div class="three-card three-card-sm">' + vocabImg(it) + '</div></div>' +
      '<div class="pair-grid">' + shuffle(v.map((o, k) => k)).map(k =>
        '<div class="vocab-cell" data-k="' + k + '" onclick="threePick(this,' + k + ')" style="font-size:30px;line-height:72px;font-weight:bold;color:var(--pink-d)">' + esc(v[k].char) + '</div>').join("") + '</div>';
    ctl.innerHTML = '<button class="ghost" onclick="threeStage()">🔊 再看一遍</button>';
  }
}
function threePick(el, j) {
  const d = DAY_DATA[CUR]; if (!d) return;
  const v = d.vocab;
  const jv = v[j];
  const target = v[thr.opted[thr.i]];
  if (!target || !jv) return;
  if (target.char === jv.char) {
    el.classList.add("ansyes"); speak("对啦，真棒！");
    setTimeout(() => {
      thr.i++;
      if (thr.i >= v.length) {
        if (thr.step === 2) { thr.step = 3; thr.i = 0; }
        else { markDone("read"); thr.step = 1; thr.i = 0; }
      }
      threeStage();
      if (thr.step === 1) toast("三段式读完啦！生字宝宝记住啦 📖");
    }, 800);
  } else {
    el.classList.add("ansno"); speak("再想一想哦");
    setTimeout(() => el.classList.remove("ansno"), 500);
  }
}

// ===================== 写一写：描红画板 =====================
let traceChar = "水";
let strokes = [];
let drawing = false;
let cv = null, ctx = null, canvasBound = false;

function renderTrace() {
  const d = DAY_DATA[CUR]; if (!d) return;
  traceChar = d.chars[0];
  strokes = [];
  $("trace-tabs").innerHTML = d.chars.map(c =>
    '<button class="' + (c === traceChar ? "sel" : "") + '" onclick="setTraceChar(this.dataset.c)" data-c="' + esc(c) + '">' + esc(c) + '</button>').join("");
  updateSeqTip();
  setupCanvas();
  redrawTrace();
}
function updateSeqTip() {
  const d = DAY_DATA[CUR]; if (!d) return;
  const seq = (d.seq && d.seq[traceChar]) || "（笔顺提示待补充）";
  $("trace-seq").textContent = "✏️ 写字宝宝「" + traceChar + "」的笔顺：" + seq;
}
function setTraceChar(c) {
  traceChar = c; strokes = [];
  document.querySelectorAll("#trace-tabs button").forEach(b =>
    b.classList.toggle("sel", b.getAttribute("data-c") === c));
  updateSeqTip();
  redrawTrace();
}
function clearTrace() { strokes = []; redrawTrace(); }
function finishTrace() {
  if (strokes.length < 2) { toast("先描一描字宝宝，再告诉兔兔写完啦 ✍️"); return; }
  confetti(); markDone("write"); toast("写一写完成！你的小手真能干 ✍️");
}
function setupCanvas() {
  cv = $("trace-canvas"); if (!cv) return;
  if (!ctx) ctx = cv.getContext("2d");
  if (canvasBound) return;
  canvasBound = true;
  cv.addEventListener("pointerdown", e => {
    e.preventDefault();
    drawing = true;
    strokes.push([getPos(e)]);
    redrawTrace();
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  });
  cv.addEventListener("pointermove", e => {
    if (!drawing) return;
    const arr = strokes[strokes.length - 1];
    if (!arr) return;
    arr.push(getPos(e));
    redrawTrace();
  });
  ["pointerup", "pointercancel", "pointerleave", "pointerout"].forEach(ev =>
    cv.addEventListener(ev, () => { drawing = false; }));
}
function getPos(e) {
  const r = cv.getBoundingClientRect();
  const sx = cv.width / (r.width || cv.width);
  const sy = cv.height / (r.height || cv.height);
  return [(e.clientX - r.left) * sx, (e.clientY - r.top) * sy];
}
function redrawTrace() {
  if (!ctx || !cv) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "#F3D9E6"; ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.beginPath();
  ctx.moveTo(W / 2, 20); ctx.lineTo(W / 2, H - 20);
  ctx.moveTo(20, H / 2); ctx.lineTo(W - 20, H / 2);
  ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "rgba(240,216,233,0.9)";
  ctx.font = "430px 'Kaiti SC','KaiTi','STKaiti','Microsoft YaHei',serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(traceChar, W / 2, H / 2 + 16);
  ctx.strokeStyle = "#F2567E"; ctx.lineWidth = 20; ctx.lineCap = "round"; ctx.lineJoin = "round";
  strokes.forEach(st => {
    if (!st || st.length < 1) return;
    ctx.beginPath();
    ctx.moveTo(st[0][0], st[0][1]);
    for (let i = 1; i < st.length; i++) ctx.lineTo(st[i][0], st[i][1]);
    ctx.stroke();
  });
}

// ===================== 玩一玩：配对游戏 + 过关 =====================
let matchSel = null, matchedCount = 0, matchComplete = false;
function renderMatch() {
  const d = DAY_DATA[CUR]; if (!d) return;
  const v = d.vocab;
  matchedCount = 0; matchComplete = false; matchSel = null;
  $("match-emoji").innerHTML = shuffle(v.map((o, k) => k)).map(k =>
    '<div class="pair-card" data-typ="e" data-k="' + k + '" onclick="matchTap(this)">' + esc(v[k].emoji) + '</div>').join("");
  $("match-char").innerHTML = shuffle(v.map((o, k) => k)).map(k =>
    '<div class="pair-card char" data-typ="c" data-k="' + k + '" onclick="matchTap(this)">' + esc(v[k].char) + '</div>').join("");
}
function matchTap(el) {
  if (el.classList.contains("matched")) return;
  const k = +el.getAttribute("data-k");
  const typ = el.getAttribute("data-typ");
  if (!matchSel) { matchSel = { typ, k, el }; el.classList.add("sel"); return; }
  if (matchSel.typ === typ) {
    matchSel.el.classList.remove("sel");
    matchSel = (matchSel.k === k) ? null : { typ, k, el };
    if (matchSel) el.classList.add("sel");
    return;
  }
  const prev = matchSel.el;
  matchSel = null;
  prev.classList.remove("sel"); el.classList.remove("sel");
  if (+prev.getAttribute("data-k") === k) {
    prev.classList.add("matched"); el.classList.add("matched");
    matchedCount++;
    const total = DAY_DATA[CUR].vocab.length;
    if (matchedCount === total) {
      matchComplete = true;
      speak("全部配对了，你真棒！再答一答下面的小问题吧");
      toast("配对成功！你是配对小达人 🧩🎉");
      maybePlayDone();
    } else { speak("对了！"); toast("配对成功！"); }
  } else {
    prev.classList.add("ansno"); el.classList.add("ansno");
    speak("不一样哦，再找找");
    setTimeout(() => { prev.classList.remove("ansno"); el.classList.remove("ansno"); }, 600);
  }
}

// ===================== 玩一玩：小过关测验 =====================
let qzCur = 0, qzLock = false;
function renderQuiz() { qzCur = 0; qzLock = false; quizStage(); }
function maybePlayDone() {
  const d = DAY_DATA[CUR]; if (!d) return;
  if (matchedCount === d.vocab.length && qzCur >= d.quiz.length) markDone("play");
}
function quizStage() {
  const d = DAY_DATA[CUR]; if (!d) return;
  const qs = d.quiz;
  if (qzCur >= qs.length) {
    $("quiz-body").innerHTML = '<div class="done-msg">🎖️ 小问题都答过啦！你听故事可真认真！</div>';
    maybePlayDone(); return;
  }
  const q = qs[qzCur];
  const opts = shuffle(q.opt.map((o, k) => k));
  $("quiz-body").innerHTML =
    '<div class="q">❓ ' + esc(q.p) + '</div>' +
    '<div class="qz-opt">' + opts.map(k => {
      const o = q.opt[k];
      return '<button data-k="' + k + '" onclick="quizPick(this,' + k + ')"><div>' + esc(o.e) + '</div><span>' + esc(o.t) + '</span></button>';
    }).join("") + '</div>';
  qzLock = false;
}
function quizPick(btn, k) {
  if (qzLock) return;
  qzLock = true;
  const q = DAY_DATA[CUR].quiz[qzCur];
  const right = q.opt[k] && q.opt[k].r === 1;
  btn.classList.add(right ? "right" : "wrong");
  if (!right) { const ok = document.querySelector('#quiz-body .qz-opt button[data-k="' + q.opt.findIndex(o => o.r === 1) + '"]'); if (ok) ok.classList.add("right"); }
  speak(right ? "答对啦！" : "是另一个哦");
  setTimeout(() => { qzCur++; quizStage(); }, right ? 900 : 1200);
}

// ===================== 早安心情打卡 =====================
function moodGreet(n) {
  clearOverlays();
  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML =
    '<div class="modal"><div class="big">🌞</div>' +
    '<h2>宝贝早上好！</h2><p>今天的小探险就要开始啦，你现在的心情怎么样呢？</p>' +
    '<div class="mood-row">' +
    '<button onclick="setMood(' + n + ',\'开心\')"><b>😄</b>很开心</button>' +
    '<button onclick="setMood(' + n + ',\'一般\')"><b>😊</b>还不错</button>' +
    '<button onclick="setMood(' + n + ',\'累\')"><b>😴</b>有点累</button>' +
    '</div></div>';
  document.body.appendChild(ov);
}
function setMood(n, m) {
  S.mood[n] = m; save();
  clearOverlays();
  const words = { "开心": "哇，心情真好！我们出发吧！", "一般": "没关系，兔兔陪着你一起玩！", "累": "先休息一小会儿，我们一起做个轻轻的小游戏。" };
  speak(words[m] || words["一般"]);
}
function showFinale() {
  clearOverlays();
  confetti();
  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML =
    '<div class="modal"><div class="big">🎓</div>' +
    '<h2>三十天探险，全部通关！</h2>' +
    '<div class="txt">🐦 乌鸦学会动脑筋<br>🍐 孔融学会礼让<br>🏺 司马光学会不慌张<br>🐢 龟兔赛跑学会坚持<br>📚 你认识了上百个汉字，会听、会说、会写、会玩<br><br>接下来可以复习任意一天：回到地图点开想看的那一关就能重新体验哦。</div>' +
    '<button onclick="closeOverlay(this);goHome()">回到地图 🗺️</button>' +
    '<div style="margin-top:8px"><button class="ghost" onclick="closeOverlay(this);openDay(1)">🔁 从第1天再走一遍</button></div>' +
    '</div>';
  document.body.appendChild(ov);
}

// ===================== 初始化 =====================
function resetAll() {
  try { localStorage.removeItem(K); } catch (e) {}
  S = { done: {}, mood: {}, welcomed: false };
  celebrating = false;
  location.reload();
}
function init() {
  setupCanvas();
  renderHome();
  fitStage();
  if (!S.welcomed) {
    S.welcomed = true; save();
    clearOverlays();
    const ov = document.createElement("div"); ov.className = "overlay";
    ov.innerHTML =
      '<div class="modal"><div class="big">🌸</div>' +
      '<h2>欢迎来到兔兔的30天中文探险</h2>' +
      '<div class="txt">' +
      '给 5 岁小朋友的中文互动学习页：<br>' +
      '👂 听一听：听经典小典故（自动朗读）<br>' +
      '🗣️ 说一说：跟读 + 录音回放<br>' +
      '📖 读一读：蒙特梭利三段式识字<br>' +
      '✍️ 写一写：描红写字板（像摸砂纸字）<br>' +
      '🎮 玩一玩：配对游戏 + 小过关<br>' +
      '每天完成 5 个环节解锁下一天，共 30 天。' +
      '</div>' +
      '<button onclick="closeOverlay(this);document.querySelector(\'#home-map .dayitem.today\').click()">开始第 1 天 🐰</button>' +
      '<div style="margin-top:8px"><button class="ghost" onclick="resetAll()">🗑️ 重置进度</button></div>' +
      '</div>';
    document.body.appendChild(ov);
  }
}
document.addEventListener("DOMContentLoaded", init);
