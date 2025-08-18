import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import {
  collection, addDoc, onSnapshot, query, orderBy,
  doc, deleteDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const auth = window.firebaseAuth;
const db   = window.firebaseDB;

// 공용 엘리먼트
const authSection = document.getElementById("auth-section");
const appSection  = document.getElementById("app-section");
const wordsSection = document.getElementById("words-section");

const userEmailEl = document.getElementById("user-email");
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
const submitAnswerBtn = document.getElementById("submit-answer");
const quizChoices   = document.getElementById("quiz-choices");
const quizFeedback  = document.getElementById("quiz-feedback");
const nextQuestionBtn = document.getElementById("next-question");
const endTestBtn    = document.getElementById("end-test");
const testResultEl  = document.getElementById("test-result");

// 상태
let unsubBooks = null;
let unsubWords = null;
let currentBook = null; // { id, name }
let wordsCache = [];    // [{id, term, meaning}, ...]

// 테스트 상태
let testRunning = false;
let testMode = "t2m"; // t2m | m2t | mcq
let quizOrder = [];   // 인덱스 배열
let quizIdx = 0;
let score = 0;
let answered = false;

// 유틸
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

// 로그인 상태
onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    wordsSection.classList.add("hidden");
    userEmailEl.textContent = user.email;
    startBooksLive(user.uid);
  } else {
    appSection.classList.add("hidden");
    wordsSection.classList.add("hidden");
    authSection.classList.remove("hidden");
    userEmailEl.textContent = "";
    bookListEl.innerHTML = "";
    wordListEl.innerHTML = "";
    if (unsubBooks) unsubBooks();
    if (unsubWords) unsubWords();
    resetTestUI();
  }
});

// 회원가입 / 로그인 / 로그아웃
signupBtn.onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailEl.value, pwEl.value);
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

// 단어장 생성
createBookBtn.onclick = async () => {
  const name = bookNameEl.value.trim();
  const user = auth.currentUser;
  if (!user) return alert("로그인 먼저!");
  if (!name) return alert("단어장 이름을 입력해줘!");
  await addDoc(collection(db, "users", user.uid, "vocabBooks"), { name, createdAt: Date.now() });
  bookNameEl.value = "";
};

// 단어장 목록 실시간
function startBooksLive(uid) {
  if (unsubBooks) unsubBooks();
  const qBooks = query(collection(db, "users", uid, "vocabBooks"), orderBy("createdAt", "desc"));
  unsubBooks = onSnapshot(qBooks, (snap) => {
    bookListEl.innerHTML = "";
    snap.forEach((d) => {
      const data = d.data();
      const li = document.createElement("li");
      const nameBtn = document.createElement("button");
      nameBtn.textContent = data.name;
      nameBtn.onclick = () => openBook({ id: d.id, name: data.name });
      li.appendChild(nameBtn);
      bookListEl.appendChild(li);
    });
  });
}

// 단어장 열기
function openBook(book) {
  currentBook = book;
  currentBookTitleEl.textContent = `단어장 – ${book.name}`;
  appSection.classList.add("hidden");
  wordsSection.classList.remove("hidden");

  // 기본 탭은 '수정'
  activateTab("manage");

  startWordsLive();
  resetTestUI();
}

// 단어 실시간 구독
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

      li.appendChild(label);
      li.appendChild(editBtn);
      li.appendChild(delBtn);
      wordListEl.appendChild(li);
    });
  });
}

// 단어 추가
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

// 목록으로
backToBooksBtn.onclick = () => {
  if (unsubWords) unsubWords();
  wordsSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  currentBook = null;
  wordListEl.innerHTML = "";
  resetTestUI();
};

// 탭 전환
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

// ===== 테스트 로직 =====
startTestBtn.onclick = () => {
  if (!wordsCache.length) return alert("단어가 없습니다. 먼저 추가해주세요!");
  testMode = testModeSel.value; // t2m | m2t | mcq
  testRunning = true;
  score = 0;
  answered = false;
  quizOrder = shuffle(wordsCache.map((_, i) => i));
  quizIdx = 0;

  hide(testResultEl);
  show(quizArea);
  quizFeedback.textContent = "";
  renderQuestion();
  updateStatus();
};

submitAnswerBtn.onclick = () => {
  if (!testRunning || answered) return;
  handleFreeAnswer();
};
nextQuestionBtn.onclick = () => {
  if (!testRunning) return;
  nextQuestion();
};
endTestBtn.onclick = () => finishTest();

function resetTestUI() {
  testRunning = false;
  score = 0;
  quizOrder = [];
  quizIdx = 0;
  answered = false;
  quizQ.textContent = "";
  quizFeedback.textContent = "";
  quizChoices.innerHTML = "";
  quizAnswerEl.value = "";
  hide(quizArea);
  hide(testResultEl);
  testStatusEl.textContent = "";
}

// 상태 표시
function updateStatus() {
  testStatusEl.textContent = `진행: ${quizIdx+1}/${quizOrder.length} | 점수: ${score}`;
}

// 문제 렌더
function renderQuestion() {
  answered = false;
  quizFeedback.textContent = "";
  quizChoices.innerHTML = "";
  quizAnswerEl.value = "";

  const w = wordsCache[quizOrder[quizIdx]];
  if (testMode === "t2m") {
    quizQ.textContent = `뜻을 쓰세요: ${w.term}`;
    show(quizFreeBox); hide(quizChoices);
  } else if (testMode === "m2t") {
    quizQ.textContent = `단어를 쓰세요: ${w.meaning}`;
    show(quizFreeBox); hide(quizChoices);
  } else { // mcq
    quizQ.textContent = `정답을 고르세요: ${w.term}`;
    hide(quizFreeBox); show(quizChoices);
    renderChoices(w);
  }
}

// 주관식 채점
function handleFreeAnswer() {
  const w = wordsCache[quizOrder[quizIdx]];
  const ans = quizAnswerEl.value.trim();
  let ok = false;
  if (testMode === "t2m") {
    ok = normalize(ans) === normalize(w.meaning);
  } else if (testMode === "m2t") {
    ok = normalize(ans) === normalize(w.term);
  }
  answered = true;
  if (ok) {
    score++;
    quizFeedback.textContent = "✅ 정답!";
  } else {
    quizFeedback.textContent = `❌ 오답. 정답: ${testMode==="t2m" ? w.meaning : w.term}`;
  }
  updateStatus();
}

// 객관식 보기 생성
function renderChoices(correct) {
  const pool = shuffle(wordsCache);
  const options = [correct];
  for (const w of pool) {
    if (options.length >= 4) break;
    if (w.id !== correct.id) options.push(w);
  }
  const shuffled = shuffle(options);

  shuffled.forEach((opt) => {
    const b = document.createElement("button");
    b.textContent = (testMode === "mcq" ? opt.meaning : opt.meaning); // mcq는 term 고정, 보기에는 뜻
    b.onclick = () => {
      if (answered) return;
      answered = true;
      if (opt.id === correct.id) {
        score++;
        quizFeedback.textContent = "✅ 정답!";
      } else {
        quizFeedback.textContent = `❌ 오답. 정답: ${correct.meaning}`;
      }
      updateStatus();
    };
    quizChoices.appendChild(b);
  });
}

// 다음 문제
function nextQuestion() {
  if (quizIdx < quizOrder.length - 1) {
    quizIdx++;
    renderQuestion();
    updateStatus();
  } else {
    finishTest();
  }
}

// 종료/결과
function finishTest() {
  testRunning = false;
  hide(quizArea);
  const total = quizOrder.length || 0;
  testResultEl.innerHTML = `<strong>결과:</strong> ${score} / ${total} 점`;
  show(testResultEl);
}

// 단순 정규화(대소문자/양끝공백)
function normalize(s) {
  return (s || "").toString().trim().toLowerCase();
}
