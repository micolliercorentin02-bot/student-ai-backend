require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dayjs = require("dayjs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// PATH du fichier JSON
const USERS_FILE = path.join(__dirname, "users.json");

// Charger les users
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE));
}

// Sauvegarder users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Limite 25 requêtes / jour
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

// ROUTE POUR POSER DES QUESTIONS
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
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    res.json({ answer: aiResponse.data.choices[0].message.content });

  } catch (err) {
    console.log(err.response?.data || err);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.listen(PORT, () => console.log("Backend running on port " + PORT));
