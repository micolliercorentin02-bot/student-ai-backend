require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dayjs = require("dayjs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// FICHIER DES UTILISATEURS (Railway OK)
const USERS_FILE = path.join(__dirname, "users.json");

// ----------------------------------------------------
// 🔧 LOAD USERS (100% sécurisé, jamais de JSON cassé)
// ----------------------------------------------------
console.log("Reading:", USERS_FILE);

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, "{}");
      return {};
    }

    const raw = fs.readFileSync(USERS_FILE, "utf8").trim();
    if (!raw) return {};

    return JSON.parse(raw);

  } catch (e) {
    console.log("⚠️ users.json corrompu, reset...");
    fs.writeFileSync(USERS_FILE, "{}");
    return {};
  }
}

// Sauvegarde
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ----------------------------------------------------
// 📌 REGISTER : créer un compte
// ----------------------------------------------------
app.post("/register", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "email/password missing" });

  const users = loadUsers();

  if (users[email]) {
    return res.status(400).json({ error: "User already exists" });
  }

  users[email] = {
    password,
    count: 0,
    last: dayjs().format("YYYY-MM-DD")
  };

  saveUsers(users);

  res.json({ success: true });
});

// ----------------------------------------------------
// 📌 LOGIN : vérifier identifiants
// ----------------------------------------------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "email/password missing" });

  const users = loadUsers();

  if (!users[email] || users[email].password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ success: true });
});

// ----------------------------------------------------
// 📌 Remaining requests
// ----------------------------------------------------
app.post("/remaining", (req, res) => {
  const { email } = req.body;

  if (!email)
    return res.status(400).json({ error: "email missing" });

  const users = loadUsers();
  if (!users[email])
    return res.status(404).json({ error: "User not found" });

  const today = dayjs().format("YYYY-MM-DD");

  if (users[email].last !== today) {
    users[email].last = today;
    users[email].count = 0;
    saveUsers(users);
  }

  const remaining = 25 - users[email].count;
  res.json({ remaining: Math.max(0, remaining) });
});

// ----------------------------------------------------
// 📌 Limiteur de requêtes
// ----------------------------------------------------
function checkLimit(email) {
  const users = loadUsers();

  if (!users[email]) {
    users[email] = { count: 0, last: dayjs().format("YYYY-MM-DD") };
  }

  const today = dayjs().format("YYYY-MM-DD");

  if (users[email].last !== today) {
    users[email].last = today;
    users[email].count = 0;
  }

  if (users[email].count >= 25) return false;

  users[email].count++;
  saveUsers(users);
  return true;
}

// ----------------------------------------------------
// 📌 ASK : envoyer une question à GPT-4o mini
// ----------------------------------------------------
app.post("/ask", async (req, res) => {
  const { email, question } = req.body;

  if (!email || !question)
    return res.status(400).json({ error: "email/question missing" });

  if (!checkLimit(email))
    return res.status(403).json({ error: "Daily limit reached (25)" });

  try {
    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: question }]
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );

    res.json({ answer: aiResponse.data.choices[0].message.content });
  } catch (err) {
    console.error("AI ERROR:", err.response?.data || err);
    res.status(500).json({ error: "AI request failed" });
  }
});

// ----------------------------------------------------
app.listen(PORT, () =>
  console.log("🔥 Backend running on port " + PORT)
);
