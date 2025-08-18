import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, deleteDoc, updateDoc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

console.log("app.js loaded v12");

const auth = window.firebaseAuth;
const db   = window.firebaseDB;

/* ===================== DOM ===================== */
const authSection = document.getElementById("auth-section");
const appSection  = document.getElementById("app-section");
const wordsSection = document.getElementById("words-section");

// 인증/유저 표기
const userDisplayEl = document.getElementById("user-display");   // index.html v10 이상
const nicknameEl = document.getElementById("nickname");          // index.html v10 이상
const emailEl = document.getElementById("email");
const pwEl    = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn  = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

// 단어장 목록
const bookNameEl = document.getElementById("book-name");
const createBookBtn = document.getElementById("create-book");
const bookListEl = document.getElementById("book-list");

// 단어장 화면
const backToBooksBtn = document.getElementById("back-to-books");
const currentBookTitleEl = document.getElementById("current-book-title");

// 탭
const tabManageBtn = document.getElementById("tab-manage");
const tabTestBtn   = document.getElementById("tab-test");
const managePane   = document.getElementById("manage-pane");
const testPane     = document.getElementById("test-pane");

// 관리 탭 (CRUD)
const wordTermEl = document.getElementById("word-term");
const wordMeaningEl = document.getElementById("word-meaning");
const addWordBtn = document.getElementById("add-word");
const wordListEl = document.getElementById("word-list");

// 테스트 탭
const testModeSel   = document.getElementById("test-mode");
const startTestBtn  = document.getElementById("start-test");
const testStatusEl  = document.getElementById("test-status");
const quizArea      = document.getElementById("quiz-area");
const quizQ         = document.getElementById("quiz-q");
const quizFreeBox   = document.getElementById("quiz-free");
const quizAnswerEl  = document.getElementById("quiz-answer");
const submitAnswerBtn = document.getElementById("submit-answer"); // 서술형 전용
const passBtn       = document.getElementById("pass-question");
const quizChoices   = document.getElementById("quiz-choices");
const quizFeedback  = document.getElementById("quiz-feedback");
const endTestBtn    = document.getElementById("end-test");
const testResultEl  = document.getElementById("test-result");

/* ===================== 상태 ===================== */
let unsubBooks = null;
let unsubWords = null;
let currentBook = null; // { id, name }
let wordsCache = [];    // [{id, term, meaning}, ...]

let testRunning = false;
let testMode = "mcq_t2m"; // mcq_t2m | mcq_m2t | free_m2t
let quizOrder = [];
let quizIdx = 0;
let score = 0;
let answered = false;
let awaitingAdvance = false;
let advanceTimer = null;

// MCQ 타이머
let mcqRemain = 0;
let mcqTick = null;

// 결과 요약 히스토리
// {term, meaning, mode, correct, userAnswer}
let testHistory = [];

/* ===================== 유틸 ===================== */
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
};
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");
const setDisabled = (el, flag) => {
  if (!el) return;
  el.disabled = flag;
  if (flag) el.setAttribute("disabled", "true");
  else el.removeAttribute("disabled");
};
const normalize = (s) => (s || "").toString().trim().toLowerCase();

function clearTimers() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
  if (mcqTick) { clearInterval(mcqTick); mcqTick = null; }
}

/* ===================== 인증 ===================== */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    wordsSection.classList.add("hidden");

    // 닉네임 표시: Auth.displayName → Firestore → 이메일
    let display = user.displayName || "";
    if (!display) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) display = snap.data().nickname || "";
      } catch {}
    }
    if (userDisplayEl) {
      userDisplayEl.textContent = display || user.email;
    } else {
      const userEmailFallback = document.getElementById("user-email");
      if (userEmailFallback) userEmailFallback.textContent = display || user.email;
    }

    startBooksLive(user.uid);
  } else {
    appSection.classList.add("hidden");
    wordsSection.classList.add("hidden");
    authSection.classList.remove("hidden");

    if (userDisplayEl) userDisplayEl.textContent = "";
    const userEmailFallback = document.getElementById("user-email");
    if (userEmailFallback) userEmailFallback.textContent = "";

    bookListEl.innerHTML = "";
    wordListEl.innerHTML = "";
    if (unsubBooks) unsubBooks();
    if (unsubWords) unsubWords();
    resetTestUI(true);
  }
});

// 회원가입 (닉네임 저장)
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
    await setDoc(doc(db, "users", cred.user.uid), {
      nickname, email, createdAt: Date.now()
    });
    alert("회원가입 완료!");
  } catch (e) {
    alert(e.message);
  }
};

loginBtn.onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, emailEl.value, pwEl.value);
  } catch (e) {
    alert(e.message);
  }
};

logoutBtn.onclick = async () => { await signOut(auth); };

/* ===================== 단어장 CRUD ===================== */
createBookBtn.onclick = async () => {
  const name = bookNameEl.value.trim();
  const user = auth.currentUser;
  if (!user) return alert("로그인 먼저!");
  if (!name) return alert("단어장 이름을 입력해줘!");
  await addDoc(collection(db, "users", user.uid, "vocabBooks"), {
    name, createdAt: Date.now()
  });
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
      li.textContent = data.name;
      li.style.cursor = "pointer";
      li.onclick = () => openBook({ id: d.id, name: data.name });
      bookListEl.appendChild(li);
    });
  });
}

function openBook(book) {
  currentBook = book;
  currentBookTitleEl.textContent = `단어장 – ${book.name}`;
  appSection.classList.add("hidden");
  wordsSection.classList.remove("hidden");

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
          term: newTerm.trim(),
          meaning: newMeaning.trim()
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

  await addDoc(collection(db, "users", user.uid, "vocabBooks", currentBook.id, "words"), {
    term, meaning, createdAt: Date.now()
  });

  wordTermEl.value = "";
  wordMeaningEl.value = "";
};

backToBooksBtn.onclick = () => {
  if (unsubWords) unsubWords();
  wordsSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  currentBook = null;
  wordListEl.innerHTML = "";
  resetTestUI(true);
};

/* ===================== 탭 ===================== */
tabManageBtn.onclick = () => activateTab("manage");
tabTestBtn.onclick   = () => activateTab("test");

function activateTab(which) {
  if (which === "manage") {
    tabManageBtn.classList.add("active");
    tabTestBtn.classList.remove("active");
    show(managePane); hide(testPane);
  } else {
    tabTestBtn.classList.add("active");
    tabManageBtn.classList.remove("active");
    show(testPane); hide(managePane);
  }
}

/* ===================== 테스트 로직 ===================== */
startTestBtn.onclick = () => {
  if (!wordsCache.length) return alert("단어가 없습니다. 먼저 추가해주세요!");
  testMode = testModeSel.value; // mcq_t2m | mcq_m2t | free_m2t

  if ((testMode === "mcq_t2m" || testMode === "mcq_m2t") && wordsCache.length < 3) {
    return alert("객관식은 최소 3개 단어가 필요해요.");
  }

  testRunning = true;
  score = 0;
  answered = false;
  awaitingAdvance = false;
  testHistory = [];
  quizOrder = shuffle(wordsCache.map((_, i) => i));
  quizIdx = 0;

  hide(testResultEl);
  show(quizArea);
  quizFeedback.textContent = "";
  renderQuestion();
  updateStatus();
};

// 서술형 제출
submitAnswerBtn.onclick = () => {
  if (!testRunning || answered || awaitingAdvance) return;
  if (testMode !== "free_m2t") return; // 서술형 전용
  const w = wordsCache[quizOrder[quizIdx]];
  const ansNorm = normalize(quizAnswerEl.value);
  const ok = ansNorm === normalize(w.term);
  answered = true;
  if (ok) score++;
  // 기록
  pushHistory(w, ok, quizAnswerEl.value);
  showFeedback(ok, correctTextForMode(w));
  scheduleNext();
};

// 패스 (오답 처리 후 3초 대기)
passBtn.onclick = () => {
  if (!testRunning || awaitingAdvance) return;
  const w = wordsCache[quizOrder[quizIdx]];
  answered = true;
  pushHistory(w, false, "(패스)");
  showFeedback(false, correctTextForMode(w));
  scheduleNext();
};

endTestBtn.onclick = () => finishTest();

function resetTestUI(hideAll=false) {
  testRunning = false;
  score = 0;
  quizOrder = [];
  quizIdx = 0;
  answered = false;
  awaitingAdvance = false;
  testHistory = [];
  clearTimers();

  quizQ.textContent = "";
  quizFeedback.textContent = "";
  quizChoices.innerHTML = "";
  quizAnswerEl.value = "";
  if (hideAll) {
    hide(quizArea);
    hide(testResultEl);
  }
  testStatusEl.textContent = "";
}

function updateStatus() {
  // 진행/점수 + (MCQ일 때만) 남은 시간
  const base = `진행: ${quizIdx+1}/${quizOrder.length} | 점수: ${score}`;
  if (testRunning && (testMode === "mcq_t2m" || testMode === "mcq_m2t") && mcqRemain > 0 && !answered) {
    testStatusEl.textContent = `${base} | 남은 시간: ${mcqRemain}s`;
  } else {
    testStatusEl.textContent = base;
  }
}

function renderQuestion() {
  answered = false;
  awaitingAdvance = false;
  quizFeedback.textContent = "";
  quizChoices.innerHTML = "";
  quizAnswerEl.value = "";
  clearTimers();

  setDisabled(passBtn, false);
  setDisabled(quizAnswerEl, false);

  const w = wordsCache[quizOrder[quizIdx]];

  if (testMode === "free_m2t") {
    // 서술형: 뜻 -> 단어(스펠링)
    quizQ.textContent = `단어를 쓰세요 (뜻): ${w.meaning}`;
    show(quizFreeBox); hide(quizChoices);
    show(submitAnswerBtn);       // 서술형은 제출 버튼 사용
    updateStatus();
  } else if (testMode === "mcq_t2m") {
    // 객관식: 단어 -> 뜻 (3지선다)
    quizQ.textContent = `정답을 고르세요 (단어 → 뜻): ${w.term}`;
    hide(quizFreeBox); show(quizChoices);
    hide(submitAnswerBtn);       // MCQ는 제출 버튼 숨김
    renderChoices(w, "meaning");
    startMcqTimer(w);
  } else {
    // mcq_m2t: 뜻 -> 단어 (3지선다)
    quizQ.textContent = `정답을 고르세요 (뜻 → 단어): ${w.meaning}`;
    hide(quizFreeBox); show(quizChoices);
    hide(submitAnswerBtn);       // MCQ는 제출 버튼 숨김
    renderChoices(w, "term");
    startMcqTimer(w);
  }
}

// MCQ 타이머 10초
function startMcqTimer(w) {
  mcqRemain = 10;
  updateStatus();
  mcqTick = setInterval(() => {
    if (!testRunning) { clearInterval(mcqTick); mcqTick = null; return; }
    if (answered) { clearInterval(mcqTick); mcqTick = null; return; }
    mcqRemain -= 1;
    updateStatus();
    if (mcqRemain <= 0) {
      clearInterval(mcqTick); mcqTick = null;
      // 시간초과 → 오답 처리
      if (!answered && !awaitingAdvance) {
        answered = true;
        pushHistory(w, false, "(시간초과)");
        showFeedback(false, correctTextForMode(w));
        scheduleNext();
      }
    }
  }, 1000);
}

// 객관식: 클릭=즉시 채점
function renderChoices(correct, showField) {
  const pool = shuffle(wordsCache.filter(x => x.id !== correct.id)).slice(0, 2);
  const options = shuffle([correct, ...pool]);

  options.forEach((opt) => {
    const b = document.createElement("button");
    b.textContent = (showField === "term" ? opt.term : opt.meaning);

    b.onclick = () => {
      if (answered || awaitingAdvance) return;
      answered = true;
      const ok = opt.id === correct.id;
      if (ok) score++;
      // 사용자가 선택한 보기 텍스트 기록
      pushHistory(correct, ok, b.textContent);
      showFeedback(ok, correctTextForMode(correct));
      scheduleNext();
    };

    quizChoices.appendChild(b);
  });
}

function showFeedback(ok, correctText) {
  quizFeedback.textContent = ok ? "✅ 정답!" : `❌ 오답. 정답: ${correctText}`;
  setDisabled(passBtn, true);
  setDisabled(quizAnswerEl, true);
  // 보기 클릭 막기
  [...quizChoices.children].forEach(btn => btn.onclick = null);
}

function correctTextForMode(w) {
  if (testMode === "mcq_t2m") return w.meaning; // 단어→뜻
  return w.term; // 나머지 두 모드는 뜻→단어
}

function scheduleNext() {
  awaitingAdvance = true;
  if (advanceTimer) clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    nextQuestion();
  }, 3000);
}

function nextQuestion() {
  if (!testRunning) return;
  if (quizIdx < quizOrder.length - 1) {
    quizIdx++;
    renderQuestion();
    updateStatus();
  } else {
    finishTest();
  }
}

// 히스토리 저장
function pushHistory(wordObj, ok, userAnswerStr) {
  testHistory.push({
    term: wordObj.term,
    meaning: wordObj.meaning,
    mode: testMode, // 해당 문제의 모드
    correct: !!ok,
    userAnswer: (userAnswerStr ?? "").toString()
  });
}

// 종료/결과
function finishTest() {
  testRunning = false;
  clearTimers();
  hide(quizArea);

  const total = quizOrder.length || 0;
  const header = `<strong>결과:</strong> ${score} / ${total} 점`;

  // 상세 목록 생성
  // 맞으면 초록, 틀리면 빨강. 서술형은 사용자가 쓴 답도 표시.
  const items = testHistory.map((h, idx) => {
    const okColor = h.correct ? "var(--ok)" : "var(--bad)";
    const modeLabel =
      h.mode === "mcq_t2m" ? "객관식 단→뜻" :
      h.mode === "mcq_m2t" ? "객관식 뜻→단" :
      "서술형 뜻→단";
    const line1 = `<div><b>${idx+1}.</b> [${modeLabel}] <code>${escapeHtml(h.term)}</code> — <em>${escapeHtml(h.meaning)}</em></div>`;
    // 서술형은 사용자가 입력한 답 표기, MCQ는 사용자가 고른 보기(또는 패스/시간초과)
    const userAns = h.userAnswer ? ` / 내가 쓴 답: "${escapeHtml(h.userAnswer)}"` : "";
    const line2 = `<div>결과: <span style="color:${okColor}; font-weight:600;">${h.correct ? "정답" : "오답"}</span>${userAns}</div>`;
    return `<li style="border-left:4px solid ${okColor}; padding-left:10px;">${line1}${line2}</li>`;
  }).join("");

  testResultEl.innerHTML = `
    <div style="margin-bottom:8px;">${header}</div>
    <ul style="display:block; gap:8px; padding-left:16px;">
      ${items}
    </ul>
  `;
  show(testResultEl);
}

// XSS 방지용 간단 escape
function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
