// ===== Firebase 설정 =====
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentUser = null;

function login() {
  const nick = document.getElementById("nicknameInput").value.trim();
  if (!nick) return alert("닉네임 입력해라");
  currentUser = nick;
  localStorage.setItem("nickname", nick);
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("mainScreen").style.display = "block";
  loadGroups();
}

window.onload = () => {
  const savedNick = localStorage.getItem("nickname");
  if (savedNick) {
    currentUser = savedNick;
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("mainScreen").style.display = "block";
    loadGroups();
  }
};

function switchTab(tabName) {
  document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
  document.getElementById(tabName).style.display = "block";
  document.querySelectorAll(".tab-bar button").forEach(btn => btn.classList.remove("active"));
  document.getElementById("btn-" + tabName).classList.add("active");
}

function createGroup() {
  const name = prompt("그룹 이름:");
  if (!name) return;
  const password = prompt("비밀번호 (없으면 Enter):") || null;
  const newRef = db.ref("groups").push();
  newRef.set({
    name: name,
    password: password,
    members: { [currentUser]: true }
  });
}

function loadGroups() {
  const listEl = document.getElementById("groupList");
  db.ref("groups").on("value", snap => {
    listEl.innerHTML = "";
    const groups = snap.val() || {};
    Object.entries(groups).forEach(([gid, gdata]) => {
      const card = document.createElement("div");
      card.className = "group-card";
      card.innerHTML = `<strong>${gdata.name}</strong> ${gdata.password ? "(비공개)" : ""}`;
      card.onclick = () => joinGroup(gid, gdata);
      listEl.appendChild(card);
    });
  });
}

function joinGroup(gid, gdata) {
  if (gdata.password) {
    const pw = prompt("비밀번호 입력:");
    if (pw !== gdata.password) return alert("비밀번호 틀림");
  }
  db.ref(`groups/${gid}/members/${currentUser}`).set(true);
  alert("그룹 가입 완료!");
}
