// app.js (Frontend)

// =====================
// KONFIG -> DEINE BACKEND-URL
// =====================

// HIER ANPASSEN:
// Beispiel nach Deployment auf Render:
// const API_BASE = "https://hbl-dashboard-api.onrender.com";
const API_BASE = "https://hbl-dashboard-api.onrender.com";

const DEMO_USER = "admin";
const DEMO_PASS = "handball";

const onLoginPage = window.location.pathname
  .toLowerCase()
  .endsWith("index.html") ||
  window.location.pathname.toLowerCase().endsWith("/") ||
  window.location.pathname.toLowerCase() === "" ;

const onDashboardPage = window.location.pathname
  .toLowerCase()
  .includes("dashboard");

// ----------------------
// AUTH / LOGIN
// ----------------------

function setAuthed() {
  localStorage.setItem("isAuthed", "true");
}
function isAuthed() {
  return localStorage.getItem("isAuthed") === "true";
}
function doLogout() {
  localStorage.removeItem("isAuthed");

  // Auf GitHub Pages heißt die Login-Seite index.html
  window.location.href = "index.html";
}

// Wenn wir auf dashboard.html sind aber nicht eingeloggt -> zurück
if (onDashboardPage && !isAuthed()) {
  window.location.href = "index.html";
}

// Login-Formular behandeln
if (onLoginPage) {
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();

      if (username === DEMO_USER && password === DEMO_PASS) {
        setAuthed();
        window.location.href = "dashboard.html";
      } else {
        loginError.textContent = "Falscher Benutzername oder Passwort.";
      }
    });
  }
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    doLogout();
  });
}

// ----------------------
// SIDEBAR TOGGLE (mobile)
// ----------------------

const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.getElementById("sidebar");

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    const isMobile = window.matchMedia("(max-width: 780px)").matches;
    if (!isMobile) return;

    if (sidebar.contains(e.target) || sidebarToggle.contains(e.target)) return;

    sidebar.classList.remove("open");
  });
}

// ----------------------
// FOOTER YEAR
// ----------------------

document.querySelectorAll("#year").forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// ----------------------
// LADEN: TABELLE & NEWS
// ----------------------

async function loadStandings() {
  try {
    const res = await fetch(`${API_BASE}/api/standings`);
    const data = await res.json();

    if (!data || !data.standings) return;

    // Tabelle rendern
    const tbody = document.getElementById("standingsBody");
    if (tbody) {
      tbody.innerHTML = "";
      data.standings.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.rank}</td>
          <td>${row.team}</td>
          <td>${row.points}</td>
          <td>${row.played}</td>
          <td>${row.wins}</td>
          <td>${row.draws}</td>
          <td>${row.losses}</td>
          <td>${row.goals}</td>
          <td>${row.diff}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // KPI-Karten füllen
    if (data.standings.length > 0) {
      const leader = data.standings[0];
      const runner = data.standings[1];

      const leaderTeamEl = document.getElementById("leaderTeam");
      const leaderPointsEl = document.getElementById("leaderPoints");
      const runnerTeamEl = document.getElementById("runnerTeam");
      const runnerPointsEl = document.getElementById("runnerPoints");
      const avgGoalsEl = document.getElementById("avgGoals");

      if (leaderTeamEl) leaderTeamEl.textContent = leader.team || "–";
      if (leaderPointsEl)
        leaderPointsEl.textContent = `${leader.points} Punkte • ${leader.played} Spiele`;

      if (runner && runnerTeamEl) runnerTeamEl.textContent = runner.team || "–";
      if (runner && runnerPointsEl)
        runnerPointsEl.textContent = `${runner.points} Punkte • ${runner.played} Spiele`;

      // Ø Tore berechnen aus leader.goals "366:297"
      if (avgGoalsEl && leader && leader.goals) {
        const [gf, ga] = leader.goals.split(":").map((n) => parseInt(n, 10));
        if (!isNaN(gf) && !isNaN(ga) && leader.played > 0) {
          const avgFor = Math.round(gf / leader.played);
          const avgAgainst = Math.round(ga / leader.played);
          avgGoalsEl.textContent = `${avgFor} : ${avgAgainst}`;
        } else {
          avgGoalsEl.textContent = "–";
        }
      }
    }
  } catch (err) {
    console.error("Fehler beim Laden der Tabelle:", err);
  }
}

async function loadNews() {
  try {
    const res = await fetch(`${API_BASE}/api/news`);
    const data = await res.json();

    if (!data || !data.news) return;
    const newsList = document.getElementById("newsList");
    if (!newsList) return;

    newsList.innerHTML = "";
    data.news.forEach((item) => {
      const div = document.createElement("div");
      div.className = "news-item";
      div.innerHTML = `
        <div class="news-headline">${item.headline}</div>
        <div class="news-meta">${item.meta}</div>
        <div class="news-text">${item.text}</div>
      `;
      newsList.appendChild(div);
    });
  } catch (err) {
    console.error("Fehler beim Laden der News:", err);
  }
}

// Refresh Button für News
const refreshNewsBtn = document.getElementById("refreshNewsBtn");
if (refreshNewsBtn) {
  refreshNewsBtn.addEventListener("click", () => {
    loadNews();
  });
}

// Wenn wir gerade auf dem Dashboard sind:
if (onDashboardPage && isAuthed()) {
  loadStandings();
  loadNews();
}
