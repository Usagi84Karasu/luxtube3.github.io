import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import sqlite3 from "sqlite3";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ dest: "uploads/" });
const db = new sqlite3.Database("./database.sqlite");

// --- Config DB ---
db.run(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  avatar TEXT
)`);
db.run(`CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  filename TEXT,
  type TEXT,
  userId TEXT
)`);

// --- Discord OAuth2 config ---
const CLIENT_ID = "1379115115353342053";
const CLIENT_SECRET = "byz6VxBG3xDsIcYSOw1V1vFNFL7PboGi";
const CALLBACK_URL = "http://localhost:3000/auth/discord/callback";

// --- Passport config ---
passport.use(
  new DiscordStrategy(
    {
      clientID: 1379115115353342053,
      clientSecret: byz6VxBG3xDsIcYSOw1V1vFNFL7PboGi,
      callbackURL: CALLBACK_URL,
      scope: ["identify"],
    },
    (accessToken, refreshToken, profile, done) => {
      const avatar = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
      db.run(
        `INSERT OR REPLACE INTO users (id, username, avatar) VALUES (?, ?, ?)`,
        [profile.id, profile.username, avatar],
        (err) => done(err, profile)
      );
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => done(err, row));
});

// --- Middleware ---
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());
app.use(
  session({
    secret: "supersecret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// --- Routes Auth ---
app.get("/auth/discord", passport.authenticate("discord"));
app.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/account.html");
  }
);

app.get("/api/me", (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: req.user });
});

app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/"));
});

// --- Upload vidéos ---
app.post("/api/upload", upload.single("video"), (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Non connecté" });
  const { title, type } = req.body;
  db.run(
    `INSERT INTO videos (title, filename, type, userId) VALUES (?, ?, ?, ?)`,
    [title, req.file.filename, type, req.user.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.get("/api/videos", (req, res) => {
  const type = req.query.type || "long";
  db.all(`SELECT * FROM videos WHERE type = ?`, [type], (err, rows) => res.json(rows));
});

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur lancé sur http://localhost:${PORT}`));
