// server.js
//
// Handball-Bundesliga API Backend
//
// Features:
//  - /api/standings   -> Tabelle (Rang, Team, Punkte, Tore, usw.)
//  - /api/news        -> News-Schlagzeilen aus der HBL
//  - /                -> Healthcheck
//
// Lokaler Test:
//   cd hbl-dashboard-api
//   npm install
//   npm start
//   Browser: http://localhost:3000
//
// Deployment (z.B. Render.com):
//   - Neues Web Service aus diesem Repo
//   - Build Command: npm install
//   - Start Command: npm start
//   - Dann bekommst du eine URL wie https://dein-api-service.onrender.com
//
// Diese URL musst du dann im Frontend als API_BASE eintragen.

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

/**
 * CORS erlauben
 *
 * Dein Frontend läuft auf GitHub Pages unter hulktheg.github.io
 * Browser blockt sonst die Requests.
 */
app.use((req, res, next) => {
  // Erlaubt deinem Frontend den Zugriff:
  res.header("Access-Control-Allow-Origin", "https://hulktheg.github.io");

  // Erlaubte HTTP-Methoden:
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");

  // Welche Header Anfragen dürfen:
  res.header("Access-Control-Allow-Headers", "Content-Type");

  // Für Preflight Requests (OPTIONS):
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

/**
 * scrapeStandings()
 * Holt die Bundesliga-Tabelle von einer öffentlichen Sportseite (sport.de).
 * sport.de zeigt Rang, Team, Spiele, Siege/Unentschieden/Niederlagen,
 * Tore, Diff, Punkte (z.B. "18:2").
 */
async function scrapeStandings() {
  const url =
    "https://www.sport.de/handball/deutschland-hbl/ergebnisse-und-tabelle/";

  // normalen Desktop-UserAgent mitsenden
  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const $ = cheerio.load(html);

  // sport.de rendert die Tabelle als Textblöcke.
  // Wir schneiden alle Zeilen raus, die nach Bundesliga-Teams aussehen.
  const lines = $("body")
    .text()
    .split("\n")
    .map((t) => t.trim())
    .filter((t) =>
      t.match(
        /^\d+\s+(SG Flensburg|SC Magdeburg|THW Kiel|Füchse Berlin|Gummersbach|Rhein\-Neckar|Melsungen|Lemgo|Frisch Auf|Hamburg|Bergischer|Hannover|Erlangen|Stuttgart|Balingen|Mind.+)/i
      )
    );

  // Beispiel-Zeile:
  // "1 SG Flensburg-Handewitt ... 10 8 2 0 366:297 69 18:2"
  //
  // Aufbau:
  // parts[0] = Rang
  // parts[1..n-8] = Teamname
  // last8 = [Spiele, Siege, Unentschieden, Niederlagen, Tore, Diff, Punkte(?), evtl. nochmal Punkte]
  //
  const standings = [];

  lines.forEach((line) => {
    const parts = line.split(/\s+/);

    // Rang ist erstes Wort
    const rank = parts[0];

    // letzten 8 Werte ziehen
    const last8 = parts.slice(-8);
    const [
      games,
      wins,
      draws,
      losses,
      goals,
      diffMaybe,
      pointsFullMaybe,
      pointsMaybe2
    ] = last8;

    // Teamname = alles zwischen Rank und den letzten 8 Tokens
    const teamTokens = parts.slice(1, parts.length - 8);
    const teamName = teamTokens.join(" ");

    // Punkte sind meist "18:2"
    const points = pointsMaybe2 ? pointsMaybe2 : pointsFullMaybe;

    // Diff evtl. nur eine Zahl (z.B. "69") -> dann "+69" draus machen
    let diff = diffMaybe;
    if (!diff.startsWith("+") && !diff.startsWith("-")) {
      diff = `+${diff}`;
    }

    standings.push({
      rank: Number(rank),
      team: teamName,
      played: Number(games),
      wins: Number(wins),
      draws: Number(draws),
      losses: Number(losses),
      goals: goals, // "366:297"
      diff: diff,   // "+69"
      points: points // "18:2"
    });
  });

  standings.sort((a, b) => a.rank - b.rank);

  return standings;
}

/**
 * scrapeNews()
 * Holt Headlines zu HBL-Teams/Spielern/Trainern/Verletzungen/etc.
 */
async function scrapeNews() {
  const url = "https://www.sport.de/handball/magazin/";

  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const $ = cheerio.load(html);

  const newsItems = [];
  $("li, article").each((_, el) => {
    const headline = $(el).text().trim();

    // wir filtern auf Bundesliga-Content
    if (
      /HBL|Füchse|Magdeburg|Kiel|Gummersbach|Rhein\-Neckar|Lemgo|Berlin|THW|Verletzung|Trainer|Topspiel|Wechsel/i.test(
        headline
      )
    ) {
      newsItems.push({
        headline,
        meta: "Handball-Bundesliga",
        text:
          "Aktuelle HBL-Meldung (Transfers, Verletzungen, Topspiele, Trainer-Themen)."
      });
    }
  });

  return newsItems.slice(0, 5);
}

// ---------------- ROUTES ----------------

// Tabelle
app.get("/api/standings", async (req, res) => {
  try {
    const data = await scrapeStandings();
    res.json({ standings: data });
  } catch (err) {
    console.error("Fehler /api/standings:", err.message);
    res.status(500).json({
      error: "Standings konnten nicht geladen werden."
    });
  }
});

// News
app.get("/api/news", async (req, res) => {
  try {
    const data = await scrapeNews();
    res.json({ news: data });
  } catch (err) {
    console.error("Fehler /api/news:", err.message);
    res.status(500).json({
      error: "News konnten nicht geladen werden."
    });
  }
});

// Healthcheck
app.get("/", (req, res) => {
  res.json({
    ok: true,
    info: "HBL Dashboard API läuft",
    endpoints: ["/api/standings", "/api/news"]
  });
});

// Server starten (lokal oder bei Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HBL Dashboard API läuft auf Port ${PORT}`);
});
