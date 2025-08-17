import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import {
  collection, addDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const auth = window.firebaseAuth;
const db   = window.firebaseDB;

// 엘리먼트
const authSection = document.getElementById("auth-section");
const appSection  = document.getElementById("app-section");
const userEmailEl = document.getElementById("user-email");

const emailEl = document.getElementById("email");
const pwEl    = document.getElementById("password");
const signupBtn = document.getElementById("signup-btn");
const loginBtn  = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const bookNameEl = document.getElementById("book-name");
const createBookBtn = document.getElementById("create-book");
const bookListEl = document.getElementById("book-list");

// 상태 반영
onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userEmailEl.textContent = user.email;
    startBooksLive(user.uid);
  } else {
    appSection.classList.add("hidden");
    authSection.classList.remove("hidden");
    userEmailEl.textContent = "";
    bookListEl.innerHTML = "";
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

// 단어장 실시간 구독
let unsubBooks = null;
function startBooksLive(uid) {
  if (unsubBooks) unsubBooks();

  const q = query(
    collection(db, "users", uid, "vocabBooks"),
    orderBy("createdAt", "desc")
  );

  unsubBooks = onSnapshot(q, (snap) => {
    bookListEl.innerHTML = "";
    snap.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc.data().name;
      bookListEl.appendChild(li);
    });
  });
}
