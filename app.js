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

// 엘리먼트
const authSection = document.getElementById("auth-section");
const appSection  = document.getElementById("app-section");
const wordsSection = document.getElementById("words-section");

const userEmailEl = document.getElementById("user-email");
const emailEl = document.getElementById("email");
const pwEl    = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn  = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const bookNameEl = document.getElementById("book-name");
const createBookBtn = document.getElementById("create-book");
const bookListEl = document.getElementById("book-list");

const backToBooksBtn = document.getElementById("back-to-books");
const currentBookTitleEl = document.getElementById("current-book-title");
const wordTermEl = document.getElementById("word-term");
const wordMeaningEl = document.getElementById("word-meaning");
const addWordBtn = document.getElementById("add-word");
const wordListEl = document.getElementById("word-list");

// 화면 전환 상태
let unsubBooks = null;
let unsubWords = null;
let currentBook = null; // { id, name }

// 로그인 상태 반영
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

logoutBtn.onclick = async () => {
  await signOut(auth);
};

// 단어장 생성
createBookBtn.onclick = async () => {
  const name = bookNameEl.value.trim();
  const user = auth.currentUser;
  if (!user) return alert("로그인 먼저!");
  if (!name) return alert("단어장 이름을 입력해줘!");

  await addDoc(collection(db, "users", user.uid, "vocabBooks"), {
    name,
    createdAt: Date.now()
  });
  bookNameEl.value = "";
};

// 단어장 실시간 구독 + 클릭 시 단어 화면으로 이동
function startBooksLive(uid) {
  if (unsubBooks) unsubBooks();

  const q = query(
    collection(db, "users", uid, "vocabBooks"),
    orderBy("createdAt", "desc")
  );

  unsubBooks = onSnapshot(q, (snap) => {
    bookListEl.innerHTML = "";
    snap.forEach((d) => {
      const data = d.data();
      const li = document.createElement("li");

      // 이름 + 버튼들
      const nameBtn = document.createElement("button");
      nameBtn.textContent = data.name;
      nameBtn.onclick = () => openBook({ id: d.id, name: data.name });

      li.appendChild(nameBtn);
      bookListEl.appendChild(li);
    });
  });
}

// 단어장 열기 → 단어 실시간 구독
function openBook(book) {
  currentBook = book;
  currentBookTitleEl.textContent = `단어 관리 – ${book.name}`;

  appSection.classList.add("hidden");
  wordsSection.classList.remove("hidden");

  startWordsLive();
}

// 단어 실시간 구독
function startWordsLive() {
  const user = auth.currentUser;
  if (!user || !currentBook) return;
  if (unsubWords) unsubWords();

  const wordsCol = collection(db, "users", user.uid, "vocabBooks", currentBook.id, "words");
  const q = query(wordsCol, orderBy("createdAt", "desc"));

  unsubWords = onSnapshot(q, (snap) => {
    wordListEl.innerHTML = "";
    snap.forEach((d) => {
      const w = d.data();
      const li = document.createElement("li");

      // 표시 텍스트
      const label = document.createElement("span");
      label.textContent = `${w.term} — ${w.meaning}`;

      // 수정 버튼
      const editBtn = document.createElement("button");
      editBtn.textContent = "수정";
      editBtn.onclick = async () => {
        const newTerm = prompt("단어(term) 수정", w.term);
        if (newTerm === null) return;
        const newMeaning = prompt("뜻(meaning) 수정", w.meaning);
        if (newMeaning === null) return;
        await updateDoc(doc(db, "users", user.uid, "vocabBooks", currentBook.id, "words", d.id), {
          term: newTerm.trim(),
          meaning: newMeaning.trim()
        });
      };

      // 삭제 버튼
      const delBtn = document.createElement("button");
      delBtn.textContent = "삭제";
      delBtn.onclick = async () => {
        if (!confirm("삭제할까요?")) return;
        await deleteDoc(doc(db, "users", user.uid, "vocabBooks", currentBook.id, "words", d.id));
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
    term,
    meaning,
    createdAt: Date.now()
  });

  wordTermEl.value = "";
  wordMeaningEl.value = "";
};

// 뒤로가기 (단어장 목록으로)
backToBooksBtn.onclick = () => {
  if (unsubWords) unsubWords();
  wordsSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  currentBook = null;
  wordListEl.innerHTML = "";
};
