// server.js
//
// Kleiner Express-Server für Handball-Bundesliga Dashboard.
// - /api/standings   -> Tabelle (Platz, Team, Punkte, etc.)
// - /api/news        -> Headlines / aktuelle Themen
//
// Lokaler Start:
//   npm install
//   npm start
//
// Dann im Browser: http://localhost:3000/api/standings
//
// Auf Render/Vercel hosten -> bekommst du eine URL wie
// https://dein-service.onrender.com
//
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

// -----------------------------------
// CORS erlauben (wichtig für GitHub Pages)
// -----------------------------------
// Dein Frontend läuft von https://hulktheg.github.io
// Wir sagen jetzt dem Browser explizit: das ist erlaubt.
// Variante 1 (sicherer): Nur GitHub Pages Domain erlauben
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://hulktheg.github.io");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  // Preflight (OPTIONS) beantworten
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Hilfsfunktion: Bundesliga Tabelle scrapen
// Quelle: öffentlich sichtbare HBL-Tabelle z.B. bei sport.de zeigt
// Rang, Team, Spiele, Siege/Unentschieden/Niederlagen, Tore, Diff, Punkte.
// SG Flensburg-Handewitt wird dort aktuell als Tabellenführer geführt,
// knapp vor SC Magdeburg und THW Kiel, mit Punkten wie "18:2". Diese Werte
// stehen als Text in den Zeilen. (Stand aktuelle Saison 2025/26.) 
// Die Struktur kann sich ändern -> ggf. Selektoren anpassen.
async function scrapeStandings() {
  const url =
    "https://www.sport.de/handball/deutschland-hbl/ergebnisse-und-tabelle/";

  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const $ = cheerio.load(html);

  // Wir holen den gesamten Body-Text, splitten in Zeilen und filtern Zeilen,
  // die wie Team-Zeilen aussehen. Wir suchen typische Bundesligateams.
  const lines = $("body")
    .text()
    .split("\n")
    .map(t => t.trim())
    .filter(t =>
      t.match(
        /^\d+\s+(SG Flensburg|SC Magdeburg|THW Kiel|Füchse Berlin|Gummersbach|Rhein\-Neckar|Melsungen|Lemgo|Frisch Auf|Hamburg|Bergischer|Hannover|Erlangen|Stuttgart|Mind.+|Balingen)/i
      )
    );

  // Jede Zeile enthält ungefähr:
  // "1 SG Flensburg-Handewitt Flensburg-H 10 8 2 0 366:297 69 18:2"
  //
  // Wir versuchen die letzten 8 Werte zu isolieren:
  // games, wins, draws, losses, goals, diff, pointsFullMaybe, pointsMaybe2

  const standings = [];

  lines.forEach(line => {
    const parts = line.split(/\s+/);

    // rank = erstes Token
    const rank = parts[0];

    // letze 8 Tokens
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

    // Team-Name = alles zwischen rank und diesen 8 Tokens
    const teamTokens = parts.slice(1, parts.length - 8);
    const teamName = teamTokens.join(" ");

    // Punkte evtl "18:2" (Punkte:Minuspunkte)
    const points = pointsMaybe2 ? pointsMaybe2 : pointsFullMaybe;

    // Diff kann z.B. "69" sein. Falls kein +/- vorne steht, prefixen.
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

  // Sortieren nach Rang, nur sicherheitshalber
  standings.sort((a, b) => a.rank - b.rank);

  return standings;
}

// Hilfsfunktion: News scrapen
// sport.de / handball / magazin listet frische HBL-News:
async function scrapeNews() {
  const url = "https://www.sport.de/handball/magazin/";

  const { data: html } = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  const $ = cheerio.load(html);

  // Wir durchsuchen Headlines, die typisch Bundesliga-relevant sind:
  // Kiel, Füchse Berlin, Magdeburg, Verletzung, Trainer etc.
  const newsItems = [];
  $("li, article").each((_, el) => {
    const headline = $(el).text().trim();
    if (
      /HBL|Füchse|Magdeburg|Kiel|Gummersbach|Rhein\-Neckar|Löwen|Lemgo|Verletzung|Wechsel|Trainer|Topspiel|Berlin|THW/i.test(
        headline
      )
    ) {
      newsItems.push({
        headline,
        meta: "Handball-Bundesliga",
        text:
          "Aktuelle Meldung aus der HBL (Transfers, Verletzungen, Topspiele, Trainer-Themen)."
      });
    }
  });

  // begrenzen auf Top 5
  return newsItems.slice(0, 5);
}

// API: Tabelle
app.get("/api/standings", async (req, res) => {
  try {
    const data = await scrapeStandings();
    res.json({ standings: data });
  } catch (err) {
    console.error("Fehler /api/standings:", err.message);
    res.status(500).json({ error: "Standings konnten nicht geladen werden." });
  }
});

// API: News
app.get("/api/news", async (req, res) => {
  try {
    const data = await scrapeNews();
    res.json({ news: data });
  } catch (err) {
    console.error("Fehler /api/news:", err.message);
    res.status(500).json({ error: "News konnten nicht geladen werden." });
  }
});

// Healthcheck / Root
app.get("/", (req, res) => {
  res.json({
    ok: true,
    info: "HBL Dashboard API läuft",
    endpoints: ["/api/standings", "/api/news"]
  });
});

// Wichtig für Render/Vercel: Port aus ENV nehmen, sonst 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HBL Dashboard API läuft auf Port ${PORT}`);
});
