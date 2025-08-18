import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, deleteDoc, updateDoc, setDoc, getDoc,
  getDocs, writeBatch, where
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

console.log("app.js v22");

const auth = window.firebaseAuth;
const db   = window.firebaseDB;

/* ===================== DOM ===================== */
const authSection = document.getElementById("auth-section");
const appSection  = document.getElementById("app-section");
const wordsSection = document.getElementById("words-section");

const userDisplayEl = document.getElementById("user-display");
const nicknameEl = document.getElementById("nickname");
const emailEl = document.getElementById("email");
const pwEl    = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn  = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

// 개인 단어장
const bookNameEl = document.getElementById("book-name");
const createBookBtn = document.getElementById("create-book");
const bookListEl = document.getElementById("book-list");

const backToBooksBtn = document.getElementById("back-to-books");
const currentBookTitleEl = document.getElementById("current-book-title");

// 탭
const tabManageBtn = document.getElementById("tab-manage");
const tabTestBtn   = document.getElementById("tab-test");
const managePane   = document.getElementById("manage-pane");
const testPane     = document.getElementById("test-pane");

// 관리 (개인)
const wordTermEl = document.getElementById("word-term");
const wordMeaningEl = document.getElementById("word-meaning");
const addWordBtn = document.getElementById("add-word");
const wordListEl = document.getElementById("word-list");

// 테스트 (개인)
const testModeSel   = document.getElementById("test-mode");
const startTestBtn  = document.getElementById("start-test");
const testStatusEl  = document.getElementById("test-status");
const quizArea      = document.getElementById("quiz-area");
const quizQ         = document.getElementById("quiz-q");
const quizFreeBox   = document.getElementById("quiz-free");
const quizAnswerEl  = document.getElementById("quiz-answer");
const submitAnswerBtn = document.getElementById("submit-answer");
const passBtn       = document.getElementById("pass-question");
const quizChoices   = document.getElementById("quiz-choices");
const quizFeedback  = document.getElementById("quiz-feedback");
const endTestBtn    = document.getElementById("end-test");
const testResultEl  = document.getElementById("test-result");

/* ====== 그룹 DOM ====== */
const groupNameEl = document.getElementById("group-name");
const createGroupBtn = document.getElementById("create-group");
const joinCodeEl = document.getElementById("join-code");
const joinGroupBtn = document.getElementById("join-group");
const myGroupListEl = document.getElementById("my-group-list");

const groupSection = document.getElementById("group-section");
const backToGroupsBtn = document.getElementById("back-to-groups");
const currentGroupTitleEl = document.getElementById("current-group-title");
const groupInviteCodeEl = document.getElementById("group-invite-code");
const leaveGroupBtn = document.getElementById("leave-group");
const groupMembersEl = document.getElementById("group-members");

// 그룹 단어장 업로드/목록
const gBookNameEl = document.getElementById("gbook-name");
const gBookFileEl = document.getElementById("gbook-file");
const gBookUploadBtn = document.getElementById("gbook-upload");
const gBookListEl = document.getElementById("gbook-list");

// 그룹 단어장 화면
const gWordsSection = document.getElementById("gwords-section");
const backToGBooksBtn = document.getElementById("back-to-gbooks");
const gCurrentBookTitleEl = document.getElementById("gcurrent-book-title");
const gOwnerNoteEl = document.getElementById("gowner-note");

const gTabManageBtn = document.getElementById("gtab-manage");
const gTabTestBtn   = document.getElementById("gtab-test");
const gManagePane   = document.getElementById("gmanage-pane");
const gTestPane     = document.getElementById("gtest-pane");

const gWordTermEl = document.getElementById("gword-term");
const gWordMeaningEl = document.getElementById("gword-meaning");
const gAddWordBtn = document.getElementById("gadd-word");
const gWordListEl = document.getElementById("gword-list");

// 테스트 DOM (그룹)
const gTestModeSel   = document.getElementById("gtest-mode");
const gStartTestBtn  = document.getElementById("gstart-test");
const gTestStatusEl  = document.getElementById("gtest-status");
const gQuizArea      = document.getElementById("gquiz-area");
const gQuizQ         = document.getElementById("gquiz-q");
const gQuizFreeBox   = document.getElementById("gquiz-free");
const gQuizAnswerEl  = document.getElementById("gquiz-answer");
const gSubmitAnswerBtn = document.getElementById("gsubmit-answer");
const gPassBtn       = document.getElementById("gpass-question");
const gQuizChoices   = document.getElementById("gquiz-choices");
const gQuizFeedback  = document.getElementById("gquiz-feedback");
const gEndTestBtn    = document.getElementById("gend-test");
const gTestResultEl  = document.getElementById("gtest-result");

/* ===================== 상태 ===================== */
let unsubBooks = null;
let unsubWords = null;
let currentBook = null;
let wordsCache = [];

let testRunning = false;
let testMode = "mcq_t2m";
let quizOrder = [];
let quizIdx = 0;
let answered = false;
let awaitingAdvance = false;
let advanceTimer = null;
let mcqRemain = 0;
let mcqTick = null;
let testHistory = [];

/* 그룹 상태 */
let unsubMyGroups = null;
let unsubGroupMembers = null;
let currentGroup = null; // { id, name, code }

/* 그룹 단어장 상태 */
let unsubGBooks = null;
let unsubGWords = null;
let currentGBook = null;     // { gid, id, name, ownerId }
let gWordsCache = [];
let gIsOwner = false;

/* 그룹 테스트 상태 */
let gTestRunning=false, gTestMode="mcq_t2m", gQuizOrder=[], gQuizIdx=0;
let gAnswered=false, gAwaiting=false, gAdvanceTimer=null;
let gMcqRemain=0, gMcqTick=null;
let gHistory=[];

/* ===================== 유틸 ===================== */
const shuffle = (arr) => { const a = arr.slice(); for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");
const setDisabled = (el, flag) => { if (!el) return; el.disabled = flag; if (flag) el.setAttribute("disabled","true"); else el.removeAttribute("disabled"); };
const normalize = (s) => (s || "").toString().trim().toLowerCase();

function clearTimers() { if (advanceTimer){clearTimeout(advanceTimer); advanceTimer=null;} if (mcqTick){clearInterval(mcqTick); mcqTick=null;} }

/* ===== 사운드 (Web Audio) ===== */
let audioCtx = null;
let soundEnabled = true;
function ensureAudio(){ if (!soundEnabled) return; if (!audioCtx){ try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch{ soundEnabled=false; } } }
function beep({freq=440, ms=120, type="sine", gain=0.04}={}){ if(!soundEnabled) return; ensureAudio(); if(!audioCtx) return; const t0=audioCtx.currentTime; const osc=audioCtx.createOscillator(); const g=audioCtx.createGain(); osc.type=type; osc.frequency.value=freq; g.gain.value=gain; osc.connect(g); g.connect(audioCtx.destination); osc.start(t0); g.gain.setValueAtTime(gain,t0); g.gain.exponentialRampToValueAtTime(0.0001,t0+ms/1000); osc.stop(t0+ms/1000+0.01); }
function playSound(kind){ if(!soundEnabled) return; ensureAudio(); if(!audioCtx) return;
  if (kind==="correct"){ [[660,80],[880,120]].forEach(([f,ms],i)=>setTimeout(()=>beep({freq:f,ms,type:"sine",gain:0.05}), i?110:0)); }
  else if (kind==="wrong"){ [[440,120],[330,120]].forEach(([f,ms],i)=>setTimeout(()=>beep({freq:f,ms,type:"square",gain:0.05}), i?100:0)); }
  else if (kind==="timeout"){ beep({freq:220,ms:160,type:"sawtooth",gain:0.06}); }
}
(function addSoundToggle(){ try{
  const btn=document.createElement("button"); btn.textContent="🔊 ON";
  btn.style.position="fixed"; btn.style.right="14px"; btn.style.bottom="14px";
  btn.style.zIndex="999"; btn.style.opacity="0.8"; btn.style.padding="8px 10px"; btn.style.borderRadius="10px";
  btn.onclick=()=>{ soundEnabled=!soundEnabled; btn.textContent=soundEnabled?"🔊 ON":"🔇 OFF"; if(soundEnabled) ensureAudio(); };
  document.addEventListener("pointerdown", ensureAudio, { once:true });
  document.body.appendChild(btn);
}catch{}})();

/* ===================== 인증 ===================== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    hide(authSection); show(appSection); hide(wordsSection); hide(groupSection); hide(gWordsSection);

    let display = user.displayName || "";
    if (!display) {
      try { const snap = await getDoc(doc(db, "users", user.uid)); if (snap.exists()) display = snap.data().nickname || ""; } catch {}
    }
    userDisplayEl.textContent = display || user.email;

    startBooksLive(user.uid);
    startMyGroupsLive(user.uid);
  } else {
    show(authSection); hide(appSection); hide(wordsSection); hide(groupSection); hide(gWordsSection);
    userDisplayEl.textContent = "";
    bookListEl.innerHTML = ""; wordListEl.innerHTML = "";
    myGroupListEl.innerHTML = ""; groupMembersEl.innerHTML = "";
    gBookListEl.innerHTML = ""; gWordListEl.innerHTML = "";
    if (unsubBooks) unsubBooks();
    if (unsubWords) unsubWords();
    if (unsubMyGroups) unsubMyGroups();
    if (unsubGroupMembers) unsubGroupMembers();
    if (unsubGBooks) unsubGBooks();
    if (unsubGWords) unsubGWords();
    resetTestUI(true); gResetTestUI(true);
  }
});

// 회원가입/로그인/로그아웃
signupBtn.onclick = async () => {
  const nickname = (nicknameEl?.value || "").trim();
  const email = (emailEl.value || "").trim();
  const pw = pwEl.value;
  if (!nickname) return alert("닉네임을 입력해줘!");
  if (!email) return alert("이메일을 입력해줘!");
  if (!pw) return alert("비밀번호를 입력해줘!");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, { displayName: nickname });
    await setDoc(doc(db, "users", cred.user.uid), { nickname, email, createdAt: Date.now() });
    alert("회원가입 완료!");
  } catch (e) { alert(e.message); }
};
loginBtn.onclick = async () => { try { await signInWithEmailAndPassword(auth, emailEl.value, pwEl.value); } catch (e) { alert(e.message); } };
logoutBtn.onclick = async () => { await signOut(auth); };

/* ===================== 개인 단어장 ===================== */
createBookBtn.onclick = async () => {
  const name = bookNameEl.value.trim();
  const user = auth.currentUser;
  if (!user) return alert("로그인 먼저!");
  if (!name) return alert("단어장 이름을 입력해줘!");
  await addDoc(collection(db, "users", user.uid, "vocabBooks"), { name, createdAt: Date.now() });
  bookNameEl.value = "";
};

function startBooksLive(uid) {
  if (unsubBooks) unsubBooks();
  const qBooks = query(collection(db, "users", uid, "vocabBooks"), orderBy("createdAt", "desc"));
  unsubBooks = onSnapshot(qBooks, (snap) => {
    bookListEl.innerHTML = "";
    snap.forEach((d) => {
      const data = d.data();
      const li = document.createElement("li");

      const label = document.createElement("span");
      label.textContent = data.name;
      label.style.cursor = "pointer";
      label.onclick = () => openBook({ id: d.id, name: data.name });

      const renameBtn = document.createElement("button");
      renameBtn.textContent = "이름수정";
      renameBtn.onclick = async (e) => {
        e.stopPropagation();
        const newName = prompt("새 단어장 이름", data.name);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed) return alert("이름을 입력해줘!");
        await updateDoc(doc(db, "users", uid, "vocabBooks", d.id), { name: trimmed });
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "삭제";
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`단어장 "${data.name}"을(를) 삭제할까요?\n(안의 단어들도 함께 삭제됩니다)`)) return;
        // 단어 모두 삭제 후 책 삭제
        const wSnap = await getDocs(collection(db, "users", uid, "vocabBooks", d.id, "words"));
        const batch = writeBatch(db);
        wSnap.forEach(ws => batch.delete(doc(db, "users", uid, "vocabBooks", d.id, "words", ws.id)));
        if (!wSnap.empty) await batch.commit();
        await deleteDoc(doc(db, "users", uid, "vocabBooks", d.id));
      };

      const btnWrap = document.createElement("div");
      btnWrap.className = "btn-wrap";
      btnWrap.appendChild(renameBtn);
      btnWrap.appendChild(delBtn);

      li.appendChild(label);
      li.appendChild(btnWrap);
      // 행 전체 클릭도 열기
      li.onclick = () => openBook({ id: d.id, name: data.name });

      bookListEl.appendChild(li);
    });
  });
}

function openBook(book) {
  currentBook = book;
  currentBookTitleEl.textContent = `단어장 – ${book.name}`;
  hide(appSection); show(wordsSection); hide(groupSection); hide(gWordsSection);
  activateTab("manage");
  startWordsLive();
  resetTestUI(true);
}

function startWordsLive() {
  const user = auth.currentUser;
  if (!user || !currentBook) return;
  if (unsubWords) unsubWords();
  const wordsCol = collection(db, "users", user.uid, "vocabBooks", currentBook.id, "words");
  const qWords = query(wordsCol, orderBy("createdAt", "desc"));
  unsubWords = onSnapshot(qWords, (snap) => {
    wordsCache = [];
    wordListEl.innerHTML = "";
    snap.forEach((d) => {
      const w = { id: d.id, ...d.data() };
      wordsCache.push(w);

      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${w.term} — ${w.meaning}`;

      const editBtn = document.createElement("button");
      editBtn.textContent = "수정";
      editBtn.onclick = async () => {
        const newTerm = prompt("단어(term) 수정", w.term);
        if (newTerm === null) return;
        const newMeaning = prompt("뜻(meaning) 수정", w.meaning);
        if (newMeaning === null) return;
        await updateDoc(doc(db, "users", user.uid, "vocabBooks", currentBook.id, "words", w.id), {
          term: newTerm.trim(), meaning: newMeaning.trim()
        });
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "삭제";
      delBtn.onclick = async () => {
        if (!confirm("삭제할까요?")) return;
        await deleteDoc(doc(db, "users", user.uid, "vocabBooks", currentBook.id, "words", w.id));
      };

      const btnWrap = document.createElement("div");
      btnWrap.className = "btn-wrap";
      btnWrap.appendChild(editBtn);
      btnWrap.appendChild(delBtn);

      li.appendChild(label);
      li.appendChild(btnWrap);
      wordListEl.appendChild(li);
    });
  });
}

addWordBtn.onclick = async () => {
  const user = auth.currentUser;
  if (!user) return alert("로그인 먼저!");
  if (!currentBook) return alert("단어장을 먼저 선택해줘!");
  const term = wordTermEl.value.trim();
  const meaning = wordMeaningEl.value.trim();
  if (!term || !meaning) return alert("단어와 뜻을 입력해줘!");
  await addDoc(collection(db, "users", user.uid, "vocabBooks", currentBook.id, "words"), { term, meaning, createdAt: Date.now() });
  wordTermEl.value = ""; wordMeaningEl.value = "";
};

backToBooksBtn.onclick = () => {
  if (unsubWords) unsubWords();
  hide(wordsSection); show(appSection);
  currentBook = null; wordListEl.innerHTML = "";
  resetTestUI(true);
};

// 탭 (개인)
tabManageBtn.onclick = () => activateTab("manage");
tabTestBtn.onclick   = () => activateTab("test");
function activateTab(which) {
  if (which === "manage") { tabManageBtn.classList.add("active"); tabTestBtn.classList.remove("active"); show(managePane); hide(testPane); }
  else { tabTestBtn.classList.add("active"); tabManageBtn.classList.remove("active"); show(testPane); hide(managePane); }
}

/* ===================== 테스트 (개인) ===================== */
startTestBtn.onclick = () => {
  if (!wordsCache.length) return alert("단어가 없습니다. 단어를 먼저 추가해주세요.");
  testMode = testModeSel.value;
  if ((testMode === "mcq_t2m" || testMode === "mcq_m2t") && wordsCache.length < 3) return alert("객관식은 최소 3개 단어가 필요합니다.");
  testRunning = true; answered = false; awaitingAdvance = false; testHistory = [];
  quizOrder = shuffle(wordsCache.map((_, i) => i)); quizIdx = 0;
  hide(testResultEl); show(quizArea); quizFeedback.textContent = "";
  renderQuestion(); updateStatus();
};

submitAnswerBtn.onclick = () => {
  if (!testRunning || answered || awaitingAdvance) return;
  if (testMode !== "free_m2t") return;
  const w = wordsCache[quizOrder[quizIdx]];
  const ok = normalize(quizAnswerEl.value) === normalize(w.term);
  answered = true;
  pushHistory(w, ok, quizAnswerEl.value);
  showFeedback(ok, correctTextForMode(w));
  playSound(ok ? "correct" : "wrong");
  scheduleNext();
};
passBtn.onclick = () => {
  if (!testRunning || awaitingAdvance) return;
  const w = wordsCache[quizOrder[quizIdx]];
  answered = true;
  pushHistory(w, false, "(패스)");
  showFeedback(false, correctTextForMode(w));
  playSound("wrong");
  scheduleNext();
};
endTestBtn.onclick = () => finishTest();

function resetTestUI(hideAll=false) {
  testRunning=false; quizOrder=[]; quizIdx=0; answered=false; awaitingAdvance=false; testHistory=[];
  clearTimers();
  quizQ.textContent=""; quizFeedback.textContent=""; quizChoices.innerHTML=""; quizAnswerEl.value="";
  if (hideAll){ hide(quizArea); hide(testResultEl); }
  testStatusEl.textContent="";
}
function updateStatus() {
  const base = `진행: ${quizIdx+1}/${quizOrder.length}`;
  if (testRunning && (testMode==="mcq_t2m"||testMode==="mcq_m2t") && mcqRemain>0 && !answered) testStatusEl.textContent = `${base} | 남은 시간: ${mcqRemain}s`;
  else testStatusEl.textContent = base;
}
function renderQuestion() {
  answered=false; awaitingAdvance=false; quizFeedback.textContent=""; quizChoices.innerHTML=""; quizAnswerEl.value=""; clearTimers();
  setDisabled(passBtn,false); setDisabled(quizAnswerEl,false);
  const w = wordsCache[quizOrder[quizIdx]];
  if (testMode==="free_m2t"){
    quizQ.textContent = `단어를 쓰세요 (뜻): ${w.meaning}`;
    show(quizFreeBox); hide(quizChoices); show(submitAnswerBtn); updateStatus();
  } else if (testMode==="mcq_t2m"){
    quizQ.textContent = `정답을 고르세요 (단어 → 뜻): ${w.term}`;
    hide(quizFreeBox); show(quizChoices); hide(submitAnswerBtn);
    renderChoices(w,"meaning"); startMcqTimer(w);
  } else {
    quizQ.textContent = `정답을 고르세요 (뜻 → 단어): ${w.meaning}`;
    hide(quizFreeBox); show(quizChoices); hide(submitAnswerBtn);
    renderChoices(w,"term"); startMcqTimer(w);
  }
}
function startMcqTimer(w){
  mcqRemain=10; updateStatus();
  mcqTick=setInterval(()=>{
    if (!testRunning) { clearInterval(mcqTick); mcqTick=null; return; }
    if (answered) { clearInterval(mcqTick); mcqTick=null; return; }
    mcqRemain-=1; updateStatus();
    if (mcqRemain<=0){
      clearInterval(mcqTick); mcqTick=null;
      if(!answered && !awaitingAdvance){ answered=true; pushHistory(w,false,"(시간초과)"); showFeedback(false, correctTextForMode(w)); playSound("timeout"); scheduleNext(); }
    }
  },1000);
}
function renderChoices(correct, field){
  const pool = shuffle(wordsCache.filter(x=>x.id!==correct.id)).slice(0,2);
  const options = shuffle([correct, ...pool]);
  options.forEach((opt)=>{
    const b=document.createElement("button");
    b.textContent = (field==="term"? opt.term : opt.meaning);
    b.onclick=()=>{
      if (answered || awaitingAdvance) return;
      answered=true; const ok = opt.id===correct.id;
      pushHistory(correct, ok, b.textContent);
      showFeedback(ok, correctTextForMode(correct));
      playSound(ok ? "correct" : "wrong");
      scheduleNext();
    };
    quizChoices.appendChild(b);
  });
}
function showFeedback(ok, correctText){
  quizFeedback.textContent = ok ? "✅ 정답!" : `❌ 오답. 정답: ${correctText}`;
  setDisabled(passBtn,true); setDisabled(quizAnswerEl,true);
  [...quizChoices.children].forEach(btn=>btn.onclick=null);
}
function correctTextForMode(w){ return (testMode==="mcq_t2m") ? w.meaning : w.term; }
function scheduleNext(){ awaitingAdvance=true; if(advanceTimer) clearTimeout(advanceTimer); advanceTimer=setTimeout(()=>{ advanceTimer=null; nextQuestion(); },2000); }
function nextQuestion(){ if (!testRunning) return; if (quizIdx < quizOrder.length-1){ quizIdx++; renderQuestion(); updateStatus(); } else { finishTest(); } }
function pushHistory(wordObj, ok, ans){ testHistory.push({ term:wordObj.term, meaning:wordObj.meaning, correct:!!ok, userAnswer:(ans??"").toString() }); }
function finishTest(){
  testRunning=false; clearTimers(); hide(quizArea);
  const total=quizOrder.length||0, correctCount=testHistory.filter(h=>h.correct).length;
  const header = `<strong>결과:</strong> ${correctCount} / ${total}`;
  const items = testHistory.map((h,i)=>{
    const okColor = h.correct ? "var(--ok)" : "var(--bad)";
    const line1 = `<div><b>${i+1}.</b> ${escapeHtml(h.term)} — <em>${escapeHtml(h.meaning)}</em></div>`;
    const userAns = h.userAnswer ? ` / 내가 쓴 답: "${escapeHtml(h.userAnswer)}"` : "";
    const line2 = `<div>결과: <span style="color:${okColor}; font-weight:600;">${h.correct ? "정답" : "오답"}</span>${userAns}</div>`;
    return `<li style="border-left:4px solid ${okColor}; padding-left:10px; margin-bottom:8px;">${line1}${line2}</li>`;
  }).join("");
  testResultEl.innerHTML = `<div style="margin-bottom:8px;">${header}</div><ul style="padding-left:16px; list-style:none; margin:0;">${items}</ul>`;
  show(testResultEl);
}

// XSS escape
function escapeHtml(s){ return (s??"").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

/* ===================== 그룹 ===================== */
function makeInviteCode(len=6){ const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s=""; for(let i=0;i<len;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return s; }

function startMyGroupsLive(uid) {
  if (unsubMyGroups) unsubMyGroups();
  const qMy = query(collection(db, "users", uid, "groups"), orderBy("joinedAt", "desc"));
  unsubMyGroups = onSnapshot(qMy, (snap) => {
    myGroupListEl.innerHTML = "";
    snap.forEach(d => {
      const g = { id: d.id, ...d.data() }; // {groupId, name, code, owner}
      const gid = g.groupId || g.id;

      const li = document.createElement("li");

      const label = document.createElement("span");
      label.textContent = g.name;
      label.style.cursor = "pointer";
      label.onclick = () => openGroup({ id: gid, name: g.name, code: g.code });

      const btnWrap = document.createElement("div");
      btnWrap.className = "btn-wrap";

      if (g.owner) {
        const renameBtn = document.createElement("button");
        renameBtn.textContent = "이름수정";
        renameBtn.onclick = async (e) => {
          e.stopPropagation();
          const newName = prompt("새 그룹 이름", g.name);
          if (newName === null) return;
          const trimmed = newName.trim();
          if (!trimmed) return alert("이름을 입력해줘!");
          await renameGroup(gid, trimmed);
        };

        const delBtn = document.createElement("button");
        delBtn.textContent = "삭제";
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          if (!confirm(`그룹 "${g.name}"을(를) 삭제할까요?\n(모든 멤버십이 해제되고 그룹이 제거됩니다)`)) return;
          await deleteGroup(gid, uid);
        };

        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(delBtn);
      }

      li.appendChild(label);
      li.appendChild(btnWrap);
      li.onclick = () => openGroup({ id: gid, name: g.name, code: g.code });
      myGroupListEl.appendChild(li);
    });
  });
}

// 그룹 만들기 / 가입
createGroupBtn.onclick = async () => {
  const user = auth.currentUser;
  const name = (groupNameEl.value || "").trim();
  if (!user) return alert("로그인 먼저!");
  if (!name) return alert("그룹 이름을 입력해줘!");

  const code = makeInviteCode();
  const groupRef = await addDoc(collection(db, "groups"), { name, code, publicJoin: true, ownerId: user.uid, createdAt: Date.now() });

  await setDoc(doc(db, "groups", groupRef.id, "members", user.uid), { uid: user.uid, nickname: user.displayName || user.email, joinedAt: Date.now(), owner: true });
  await setDoc(doc(db, "users", user.uid, "groups", groupRef.id), { groupId: groupRef.id, name, code, joinedAt: Date.now(), owner: true });

  groupNameEl.value = "";
  openGroup({ id: groupRef.id, name, code });
};

joinGroupBtn.onclick = async () => {
  const user = auth.currentUser;
  const code = (joinCodeEl.value || "").trim().toUpperCase();
  if (!user) return alert("로그인 먼저!");
  if (!code) return alert("초대코드를 입력해줘!");

  const q = query(collection(db, "groups"), where("code","==",code), where("publicJoin","==",true));
  const snap = await getDocs(q);
  if (snap.empty) return alert("해당 코드의 공개 그룹이 없어요.");

  const gdoc = snap.docs[0];
  const gid = gdoc.id;
  const data = gdoc.data();

  const myRef = doc(db, "users", user.uid, "groups", gid);
  const mySnap = await getDoc(myRef);
  if (mySnap.exists()) {
    alert("이미 가입된 그룹이야!");
    joinCodeEl.value = "";
    return openGroup({ id: gid, name: data.name, code: data.code });
  }

  await setDoc(doc(db, "groups", gid, "members", user.uid), { uid: user.uid, nickname: user.displayName || user.email, joinedAt: Date.now(), owner: user.uid === data.ownerId });
  await setDoc(myRef, { groupId: gid, name: data.name, code: data.code, joinedAt: Date.now(), owner: user.uid === data.ownerId });

  joinCodeEl.value = "";
  openGroup({ id: gid, name: data.name, code: data.code });
};

// 그룹 열기/뒤로/탈퇴
function openGroup(g) {
  currentGroup = g;
  currentGroupTitleEl.textContent = `그룹 – ${g.name}`;
  groupInviteCodeEl.textContent = g.code || "";

  hide(appSection); hide(wordsSection); hide(gWordsSection); show(groupSection);

  startMembersLive(g.id);
  startGBooksLive(g.id); // 그룹 단어장 목록
}
function startMembersLive(gid) {
  if (unsubGroupMembers) unsubGroupMembers();
  const qMem = query(collection(db, "groups", gid, "members"), orderBy("joinedAt", "asc"));
  unsubGroupMembers = onSnapshot(qMem, (snap) => {
    groupMembersEl.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const li = document.createElement("li");
      li.textContent = m.nickname + (m.owner ? " (관리자)" : "");
      groupMembersEl.appendChild(li);
    });
  });
}
backToGroupsBtn.onclick = () => {
  if (unsubGroupMembers) unsubGroupMembers();
  if (unsubGBooks) unsubGBooks();
  currentGroup = null; groupMembersEl.innerHTML = ""; gBookListEl.innerHTML="";
  hide(groupSection); show(appSection);
};
leaveGroupBtn.onclick = async () => {
  const user = auth.currentUser; if (!user || !currentGroup) return;
  if (!confirm("정말 탈퇴할까요?")) return;
  const gid = currentGroup.id;
  await deleteDoc(doc(db, "groups", gid, "members", user.uid));
  await deleteDoc(doc(db, "users", user.uid, "groups", gid));
  backToGroupsBtn.onclick();
  alert("탈퇴했어!");
};

// 그룹 이름변경/삭제 (소유자)
async function renameGroup(groupId, newName) {
  await updateDoc(doc(db, "groups", groupId), { name: newName });
  const membersSnap = await getDocs(collection(db, "groups", groupId, "members"));
  const batch = writeBatch(db);
  membersSnap.forEach(m => {
    batch.update(doc(db, "users", m.id, "groups", groupId), { name: newName });
  });
  await batch.commit();
}
async function deleteGroup(groupId, ownerUid) {
  // 멤버십 정리
  const memSnap = await getDocs(collection(db, "groups", groupId, "members"));
  const batch = writeBatch(db);
  memSnap.forEach(m => {
    batch.delete(doc(db, "users", m.id, "groups", groupId));
    batch.delete(doc(db, "groups", groupId, "members", m.id));
  });
  await batch.commit();

  // 그룹 단어장 전체 제거
  const gBooks = await getDocs(collection(db, "groups", groupId, "vocabBooks"));
  for (const b of gBooks.docs) {
    const wSnap = await getDocs(collection(db, "groups", groupId, "vocabBooks", b.id, "words"));
    const wb = writeBatch(db);
    wSnap.forEach(ws => wb.delete(doc(db, "groups", groupId, "vocabBooks", b.id, "words", ws.id)));
    if (!wSnap.empty) await wb.commit();
    await deleteDoc(doc(db, "groups", groupId, "vocabBooks", b.id));
  }

  await deleteDoc(doc(db, "groups", groupId));
}

/* ===================== 그룹 단어장 업로드/목록 ===================== */
function startGBooksLive(gid) {
  if (unsubGBooks) unsubGBooks();
  const qBooks = query(collection(db, "groups", gid, "vocabBooks"), orderBy("createdAt","desc"));
  unsubGBooks = onSnapshot(qBooks, (snap) => {
    gBookListEl.innerHTML = "";
    snap.forEach(d => {
      const b = { id: d.id, ...d.data() }; // {name, ownerId}
      const li = document.createElement("li");

      const label = document.createElement("span");
      label.textContent = `${b.name}`;
      label.style.cursor = "pointer";
      label.onclick = () => openGBook(gid, b);

      const btnWrap = document.createElement("div");
      btnWrap.className = "btn-wrap";
      if (auth.currentUser && auth.currentUser.uid === b.ownerId) {
        const renameBtn = document.createElement("button");
        renameBtn.textContent = "이름수정";
        renameBtn.onclick = async (e) => {
          e.stopPropagation();
          const nn = prompt("새 단어장 이름", b.name);
          if (nn === null) return;
          const trimmed = nn.trim();
          if (!trimmed) return alert("이름을 입력해줘!");
          await updateDoc(doc(db, "groups", gid, "vocabBooks", b.id), { name: trimmed });
        };

        const delBtn = document.createElement("button");
        delBtn.textContent = "삭제";
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          if (!confirm(`그룹 단어장 "${b.name}"을(를) 삭제할까요?`)) return;
          const wSnap = await getDocs(collection(db, "groups", gid, "vocabBooks", b.id, "words"));
          const batch = writeBatch(db);
          wSnap.forEach(ws => batch.delete(doc(db, "groups", gid, "vocabBooks", b.id, "words", ws.id)));
          if (!wSnap.empty) await batch.commit();
          await deleteDoc(doc(db, "groups", gid, "vocabBooks", b.id));
        };

        btnWrap.appendChild(renameBtn);
        btnWrap.appendChild(delBtn);
      }

      li.appendChild(label);
      li.appendChild(btnWrap);
      li.onclick = () => openGBook(gid, b);
      gBookListEl.appendChild(li);
    });
  });
}

// CSV 업로드 → 새 그룹 단어장 + 단어 일괄 추가(ownerId=본인)
gBookUploadBtn.onclick = async () => {
  const user = auth.currentUser;
  if (!user) return alert("로그인 먼저!");
  if (!currentGroup) return alert("그룹을 먼저 열어줘!");

  const name = (gBookNameEl.value || "").trim() || (gBookFileEl.files?.[0]?.name || "").replace(/\.[^.]+$/,'');
  if (!name) return alert("단어장 이름 또는 파일을 선택해줘!");

  const file = gBookFileEl.files?.[0];
  if (!file) return alert("CSV 파일을 선택해줘!");

  const text = await file.text();
  const rows = parseCSV(text); // [ [term, meaning], ... ]
  if (!rows.length) return alert("추가할 단어가 없습니다.");

  const bookRef = await addDoc(collection(db, "groups", currentGroup.id, "vocabBooks"), { name, ownerId: user.uid, createdAt: Date.now() });

  const chunks = chunk(rows, 400);
  for (const part of chunks) {
    const batch = writeBatch(db);
    part.forEach(([term, meaning]) => {
      const ref = doc(collection(db, "groups", currentGroup.id, "vocabBooks", bookRef.id, "words"));
      batch.set(ref, { term:(term||"").trim(), meaning:(meaning||"").trim(), ownerId:user.uid, createdAt: Date.now() });
    });
    await batch.commit();
  }

  gBookNameEl.value = ""; gBookFileEl.value = "";
  openGBook(currentGroup.id, { id: bookRef.id, name, ownerId: user.uid });
};

function openGBook(gid, b) {
  currentGBook = { gid, ...b };
  gIsOwner = auth.currentUser && (auth.currentUser.uid === b.ownerId);
  gCurrentBookTitleEl.textContent = `그룹 단어장 – ${b.name}`;
  gOwnerNoteEl.textContent = gIsOwner ? "🔒 이 단어장은 내가 업로드함 — 수정/삭제 가능" : "읽기 전용 — 업로더만 수정/삭제 가능";

  hide(appSection); hide(wordsSection); hide(groupSection); show(gWordsSection);

  startGWordsLive();
  gResetTestUI(true);
  [gWordTermEl, gWordMeaningEl, gAddWordBtn].forEach(el => setDisabled(el, !gIsOwner));
}
backToGBooksBtn.onclick = () => {
  if (unsubGWords) unsubGWords();
  currentGBook = null; gWordsCache = []; gWordListEl.innerHTML = "";
  gResetTestUI(true);
  hide(gWordsSection); show(groupSection);
};

function startGWordsLive() {
  const user = auth.currentUser; if (!user || !currentGBook) return;
  if (unsubGWords) unsubGWords();

  const wordsCol = collection(db, "groups", currentGBook.gid, "vocabBooks", currentGBook.id, "words");
  const qWords = query(wordsCol, orderBy("createdAt", "desc"));
  unsubGWords = onSnapshot(qWords, (snap) => {
    gWordsCache = [];
    gWordListEl.innerHTML = "";
    snap.forEach((d) => {
      const w = { id: d.id, ...d.data() };
      gWordsCache.push(w);

      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = `${w.term} — ${w.meaning}`;

      const btnWrap = document.createElement("div");
      btnWrap.className = "btn-wrap";

      // 단어 업로더만 수정/삭제
      const isOwner = (user.uid === w.ownerId);
      if (isOwner) {
        const editBtn = document.createElement("button");
        editBtn.textContent = "수정";
        editBtn.onclick = async () => {
          const nt = prompt("단어(term) 수정", w.term); if (nt === null) return;
          const nm = prompt("뜻(meaning) 수정", w.meaning); if (nm === null) return;
          await updateDoc(doc(db, "groups", currentGBook.gid, "vocabBooks", currentGBook.id, "words", w.id), { term: nt.trim(), meaning: nm.trim() });
        };
        const delBtn = document.createElement("button");
        delBtn.textContent = "삭제";
        delBtn.onclick = async () => {
          if (!confirm("삭제할까요?")) return;
          await deleteDoc(doc(db, "groups", currentGBook.gid, "vocabBooks", currentGBook.id, "words", w.id));
        };
        btnWrap.appendChild(editBtn); btnWrap.appendChild(delBtn);
      }

      li.appendChild(label);
      li.appendChild(btnWrap);
      gWordListEl.appendChild(li);
    });
  });
}

// 그룹 단어 추가(업로더만)
gAddWordBtn.onclick = async () => {
  const user = auth.currentUser;
  if (!user) return alert("로그인 먼저!");
  if (!currentGBook) return alert("그룹 단어장을 먼저 열어줘!");
  if (!gIsOwner) return alert("업로더만 단어를 추가할 수 있어!");

  const term = (gWordTermEl.value || "").trim();
  const meaning = (gWordMeaningEl.value || "").trim();
  if (!term || !meaning) return alert("단어와 뜻을 입력해줘!");

  await addDoc(collection(db, "groups", currentGBook.gid, "vocabBooks", currentGBook.id, "words"), {
    term, meaning, ownerId: user.uid, createdAt: Date.now()
  });

  gWordTermEl.value = ""; gWordMeaningEl.value = "";
};

/* ===================== 그룹 테스트 ===================== */
gStartTestBtn.onclick = () => {
  if (!gWordsCache.length) return alert("단어가 없습니다.");
  gTestMode = gTestModeSel.value;
  if ((gTestMode==="mcq_t2m"||gTestMode==="mcq_m2t") && gWordsCache.length<3) return alert("객관식은 최소 3개 단어가 필요합니다.");
  gTestRunning=true; gAnswered=false; gAwaiting=false; gHistory=[];
  gQuizOrder = shuffle(gWordsCache.map((_,i)=>i)); gQuizIdx=0;
  hide(gTestResultEl); show(gQuizArea); gQuizFeedback.textContent=""; gRenderQ(); gUpdateStatus();
};
gSubmitAnswerBtn.onclick = () => {
  if (!gTestRunning || gAnswered || gAwaiting) return;
  if (gTestMode !== "free_m2t") return;
  const w = gWordsCache[gQuizOrder[gQuizIdx]];
  const ok = normalize(gQuizAnswerEl.value) === normalize(w.term);
  gAnswered=true; gPushHistory(w, ok, gQuizAnswerEl.value); gShowFeedback(ok, gCorrectText(w)); playSound(ok?"correct":"wrong"); gScheduleNext();
};
gPassBtn.onclick = () => {
  if (!gTestRunning || gAwaiting) return;
  const w = gWordsCache[gQuizOrder[gQuizIdx]];
  gAnswered=true; gPushHistory(w,false,"(패스)"); gShowFeedback(false, gCorrectText(w)); playSound("wrong"); gScheduleNext();
};
gEndTestBtn.onclick = () => gFinish();

function gResetTestUI(hideAll=false){
  gTestRunning=false; gQuizOrder=[]; gQuizIdx=0; gAnswered=false; gAwaiting=false; gHistory=[];
  if (gAdvanceTimer){ clearTimeout(gAdvanceTimer); gAdvanceTimer=null; }
  if (gMcqTick){ clearInterval(gMcqTick); gMcqTick=null; }
  gQuizQ.textContent=""; gQuizFeedback.textContent=""; gQuizChoices.innerHTML=""; gQuizAnswerEl.value="";
  if (hideAll){ hide(gQuizArea); hide(gTestResultEl); }
  gTestStatusEl.textContent="";
}
function gUpdateStatus(){ const base=`진행: ${gQuizIdx+1}/${gQuizOrder.length}`; if (gTestRunning&&(gTestMode==="mcq_t2m"||gTestMode==="mcq_m2t")&&gMcqRemain>0&&!gAnswered) gTestStatusEl.textContent=`${base} | 남은 시간: ${gMcqRemain}s`; else gTestStatusEl.textContent=base; }
function gRenderQ(){
  gAnswered=false; gAwaiting=false; gQuizFeedback.textContent=""; gQuizChoices.innerHTML=""; gQuizAnswerEl.value="";
  const w = gWordsCache[gQuizOrder[gQuizIdx]];
  if (gTestMode==="free_m2t"){ gQuizQ.textContent=`단어를 쓰세요 (뜻): ${w.meaning}`; show(gQuizFreeBox); hide(gQuizChoices); show(gSubmitAnswerBtn); gUpdateStatus(); }
  else if (gTestMode==="mcq_t2m"){ gQuizQ.textContent=`정답을 고르세요 (단어 → 뜻): ${w.term}`; hide(gQuizFreeBox); show(gQuizChoices); hide(gSubmitAnswerBtn); gRenderChoices(w,"meaning"); gStartMcqTimer(w); }
  else { gQuizQ.textContent=`정답을 고르세요 (뜻 → 단어): ${w.meaning}`; hide(gQuizFreeBox); show(gQuizChoices); hide(gSubmitAnswerBtn); gRenderChoices(w,"term"); gStartMcqTimer(w); }
}
function gStartMcqTimer(w){ gMcqRemain=10; gUpdateStatus(); gMcqTick=setInterval(()=>{ if(!gTestRunning||gAnswered){clearInterval(gMcqTick); gMcqTick=null; return;} gMcqRemain-=1; gUpdateStatus(); if(gMcqRemain<=0){ clearInterval(gMcqTick); gMcqTick=null; if(!gAnswered && !gAwaiting){ gAnswered=true; gPushHistory(w,false,"(시간초과)"); gShowFeedback(false, gCorrectText(w)); playSound("timeout"); gScheduleNext(); } } },1000); }
function gRenderChoices(correct, field){
  const pool = shuffle(gWordsCache.filter(x=>x.id!==correct.id)).slice(0,2);
  const options = shuffle([correct, ...pool]);
  options.forEach((opt)=>{ const b=document.createElement("button"); b.textContent=(field==="term"?opt.term:opt.meaning);
    b.onclick=()=>{ if(gAnswered||gAwaiting) return; gAnswered=true; const ok=opt.id===correct.id; gPushHistory(correct, ok, b.textContent); gShowFeedback(ok, gCorrectText(correct)); playSound(ok?"correct":"wrong"); gScheduleNext(); };
    gQuizChoices.appendChild(b);
  });
}
function gShowFeedback(ok, correctText){ gQuizFeedback.textContent = ok ? "✅ 정답!" : `❌ 오답. 정답: ${correctText}`; }
function gCorrectText(w){ return (gTestMode==="mcq_t2m")? w.meaning : w.term; }
function gScheduleNext(){ gAwaiting=true; if(gAdvanceTimer) clearTimeout(gAdvanceTimer); gAdvanceTimer=setTimeout(()=>{ gAdvanceTimer=null; gNext(); },2000); }
function gNext(){ if (!gTestRunning) return; if (gQuizIdx<gQuizOrder.length-1){ gQuizIdx++; gRenderQ(); gUpdateStatus(); } else gFinish(); }
function gPushHistory(wordObj, ok, ans){ gHistory.push({ term:wordObj.term, meaning:wordObj.meaning, correct:!!ok, userAnswer:(ans??"").toString() }); }
function gFinish(){
  gTestRunning=false; if(gAdvanceTimer){clearTimeout(gAdvanceTimer); gAdvanceTimer=null;} if(gMcqTick){clearInterval(gMcqTick); gMcqTick=null;}
  hide(gQuizArea);
  const total=gQuizOrder.length||0, correctCount=gHistory.filter(h=>h.correct).length;
  const header=`<strong>결과:</strong> ${correctCount} / ${total}`;
  const items = gHistory.map((h,i)=>{ const okColor=h.correct?"var(--ok)":"var(--bad)"; const line1=`<div><b>${i+1}.</b> ${escapeHtml(h.term)} — <em>${escapeHtml(h.meaning)}</em></div>`; const userAns=h.userAnswer?` / 내가 쓴 답: "${escapeHtml(h.userAnswer)}"`:""; const line2=`<div>결과: <span style="color:${okColor}; font-weight:600;">${h.correct?"정답":"오답"}</span>${userAns}</div>`; return `<li style="border-left:4px solid ${okColor}; padding-left:10px; margin-bottom:8px;">${line1}${line2}</li>`; }).join("");
  gTestResultEl.innerHTML=`<div style="margin-bottom:8px;">${header}</div><ul style="padding-left:16px; list-style:none; margin:0;">${items}</ul>`;
  show(gTestResultEl);
}

/* ===================== CSV & 기타 유틸 ===================== */
function parseCSV(text){
  const rows=[]; let i=0, s=text.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  while(i<s.length){
    const row=[];
    while(true){
      if(i>=s.length||s[i]==="\n"){ if(i<s.length&&s[i]==="\n") i++; break; }
      let val="";
      if(s[i]==='"'){ i++; while(i<s.length){ if(s[i]==='"'&&s[i+1]==='"'){ val+='"'; i+=2; continue; } if(s[i]==='"'){ i++; break; } val+=s[i++]; } if(s[i]===",") i++; else if(s[i]==="\n"){ i++; } }
      else { while(i<s.length && s[i]!=="," && s[i]!=="\n") val+=s[i++]; if(s[i]===",") i++; else if(s[i]==="\n"){ i++; } }
      row.push(val.trim());
      if(s[i-1]==="\n") break;
      if(i>=s.length||s[i]==="\n"){ if(s[i]==="\n") i++; break; }
    }
    if(row.length && (row[0]||row[1])){ if(row.length===1) row.push(""); rows.push([row[0],row[1]]); }
  }
  return rows;
}
function chunk(arr,n){ const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out; }
