import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";
import cors from "cors"; //

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("voting.db");
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (!resend) {
  console.warn("⚠️ RESEND_API_KEY is not set. Email verification will not work.");
} else {
  console.log("✅ Resend API client initialized.");
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    avatar TEXT,
    is_admin INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    creator_id INTEGER,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(creator_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER,
    text TEXT,
    FOREIGN KEY(survey_id) REFERENCES surveys(id)
  );

  CREATE TABLE IF NOT EXISTS options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER,
    text TEXT,
    FOREIGN KEY(question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    survey_id INTEGER,
    question_id INTEGER,
    option_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, question_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(survey_id) REFERENCES surveys(id),
    FOREIGN KEY(question_id) REFERENCES questions(id),
    FOREIGN KEY(option_id) REFERENCES options(id)
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    code TEXT,
    expires_at DATETIME
  );
`);

// Migration blocks
try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const hasIsAdmin = tableInfo.some((col: any) => col.name === 'is_admin');
  if (!hasIsAdmin) {
    db.prepare("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0").run();
  }
  const hasIsBlocked = tableInfo.some((col: any) => col.name === 'is_blocked');
  if (!hasIsBlocked) {
    db.prepare("ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0").run();
  }
  const surveyInfo = db.prepare("PRAGMA table_info(surveys)").all();
  const hasImageUrl = surveyInfo.some((col: any) => col.name === 'image_url');
  if (!hasImageUrl) {
    db.prepare("ALTER TABLE surveys ADD COLUMN image_url TEXT").run();
  }
} catch (e) {
  console.error("Migration error (users columns):", e);
}

try {
  const tableInfo = db.prepare("PRAGMA table_info(options)").all();
  const hasQuestionId = tableInfo.some((col: any) => col.name === 'question_id');
  if (!hasQuestionId) {
    db.exec(`
      DROP TABLE IF EXISTS votes;
      DROP TABLE IF EXISTS options;
      DROP TABLE IF EXISTS questions;
      
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        survey_id INTEGER,
        text TEXT,
        FOREIGN KEY(survey_id) REFERENCES surveys(id)
      );

      CREATE TABLE IF NOT EXISTS options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER,
        text TEXT,
        FOREIGN KEY(question_id) REFERENCES questions(id)
      );

      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        survey_id INTEGER,
        question_id INTEGER,
        option_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, question_id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(survey_id) REFERENCES surveys(id),
        FOREIGN KEY(question_id) REFERENCES questions(id),
        FOREIGN KEY(option_id) REFERENCES options(id)
      );
    `);
  }
} catch (e) {
  console.error("Migration error (options/questions):", e);
}

// Seed Database
try {
  const insertUser = db.prepare("INSERT INTO users (username, password, full_name, phone, email, is_admin) VALUES (?, ?, ?, ?, ?, ?)");
  const adminExists = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
  if (!adminExists) {
    insertUser.run("admin", "admin123", "Asosiy Admin", "+998901234567", "admin@glassvote.uz", 1);
    console.log("Admin created: admin / admin123");
  }
  const userExists = db.prepare("SELECT id FROM users WHERE username = ?").get("user");
  if (!userExists) {
    insertUser.run("user", "user123", "Oddiy Foydalanuvchi", "+998907654321", "user@glassvote.uz", 0);
    console.log("User created: user / user123");
  }
} catch (e) {
  console.error("Seeding error:", e);
}

async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch (error) {
    console.error("Telegram error:", error);
  }
}

async function startServer() {
  const app = express();

  // CORS SOZLAMASI (APK UCHUN ENG MUHIMI)
  app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'user-id'],
    credentials: true
  }));
  app.options('*', cors()); 

  app.use(express.json());

  // REQUEST LOGGING (Logs bo'limida ko'rinish uchun)
  app.use((req, res, next) => {
    console.log(`📡 [${new Date().toLocaleString()}] ${req.method} ${req.url}`);
    next();
  });

  // Auth Routes
  app.post("/api/auth/send-code", async (req, res) => {
    const { email } = req.body;
    if (!resend) return res.status(500).json({ error: "Email xizmati sozlanmagan." });
    if (!email) return res.status(400).json({ error: "Email manzili kiritilmagan." });

    const recipientEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    try {
      db.prepare("DELETE FROM verification_codes WHERE email = ?").run(recipientEmail);
      db.prepare("INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)").run(recipientEmail, code, expiresAt);

      const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: recipientEmail,
        subject: 'GlassVote: Tasdiqlash kodi',
        html: `<p>Sizning tasdiqlash kodingiz: <strong>${code}</strong>. Kod 5 daqiqa davomida amal qiladi.</p>`
      });

      if (error) {
        console.error("Resend API Error:", error);
        return res.status(400).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error("Server Error:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { username, password, full_name, phone, email, code } = req.body;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const now = new Date().toISOString();
      const verification = db.prepare("SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > ?").get(normalizedEmail, code, now);
      
      if (!verification) return res.status(400).json({ error: "Tasdiqlash kodi noto'g'ri." });

      const existingUsername = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
      if (existingUsername) return res.status(400).json({ error: "Username band." });

      const info = db.prepare("INSERT INTO users (username, password, full_name, phone, email) VALUES (?, ?, ?, ?, ?)").run(username, password, full_name, phone, normalizedEmail);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      db.prepare("DELETE FROM verification_codes WHERE email = ?").run(normalizedEmail);

      sendTelegramMessage(`🆕 Yangi foydalanuvchi: ${full_name}`);
      res.json({ success: true, user });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      if (user.is_blocked) return res.status(403).json({ error: "Siz bloklangansiz." });
      res.json({ success: true, user });
    } else {
      res.status(401).json({ error: "Login yoki parol xato" });
    }
  });

  app.delete("/api/users/me", (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Survey Routes
  app.get("/api/surveys", (req, res) => {
    const surveys = db.prepare(`
      SELECT s.*, u.full_name as creator_name,
      (SELECT COUNT(DISTINCT user_id) FROM votes WHERE survey_id = s.id) as total_participants
      FROM surveys s
      JOIN users u ON s.creator_id = u.id
      ORDER BY s.created_at DESC
    `).all();
    
    const result = surveys.map((s: any) => {
      const questions = db.prepare("SELECT * FROM questions WHERE survey_id = ?").all(s.id);
      return {
        ...s,
        questions: questions.map((q: any) => ({
          ...q,
          options: db.prepare("SELECT * FROM options WHERE question_id = ?").all(q.id)
        }))
      };
    });
    res.json(result);
  });

  app.post("/api/surveys", (req, res) => {
    const { title, description, image_url, creator_id, questions } = req.body;
    const user = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(creator_id);
    if (!user?.is_admin) return res.status(403).json({ error: "Faqat adminlar uchun." });

    const transaction = db.transaction(() => {
      const info = db.prepare("INSERT INTO surveys (title, description, image_url, creator_id) VALUES (?, ?, ?, ?)").run(title, description, image_url, creator_id);
      const sId = info.lastInsertRowid;
      for (const q of questions) {
        const qId = db.prepare("INSERT INTO questions (survey_id, text) VALUES (?, ?)").run(sId, q.text).lastInsertRowid;
        for (const opt of q.options) {
          db.prepare("INSERT INTO options (question_id, text) VALUES (?, ?)").run(qId, opt);
        }
      }
      return sId;
    });
    res.json({ success: true, id: transaction() });
  });

  app.delete("/api/surveys/:id", (req, res) => {
    const { admin_id } = req.query;
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(Number(admin_id));
    if (!admin?.is_admin) return res.status(403).json({ error: "Ruxsat yo'q" });

    try {
      db.transaction(() => {
        const sId = req.params.id;
        db.prepare("DELETE FROM votes WHERE survey_id = ?").run(sId);
        db.prepare("DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE survey_id = ?)").run(sId);
        db.prepare("DELETE FROM questions WHERE survey_id = ?").run(sId);
        db.prepare("DELETE FROM surveys WHERE id = ?").run(sId);
      })();
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/surveys/:id", (req, res) => {
    const { title, description, image_url, admin_id, questions } = req.body;
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(admin_id);
    if (!admin?.is_admin) return res.status(403).json({ error: "Admin emas." });

    try {
      db.prepare("UPDATE surveys SET title = ?, description = ?, image_url = ? WHERE id = ?").run(title, description, image_url, req.params.id);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/surveys/:id/vote", (req, res) => {
    const { user_id, votes } = req.body;
    const sId = req.params.id;
    try {
      db.transaction(() => {
        for (const v of votes) {
          db.prepare("INSERT INTO votes (user_id, survey_id, question_id, option_id) VALUES (?, ?, ?, ?)").run(user_id, sId, v.question_id, v.option_id);
        }
      })();
      res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "Ovoz berishda xato." }); }
  });

  app.get("/api/surveys/:id/results", (req, res) => {
    const questions = db.prepare("SELECT * FROM questions WHERE survey_id = ?").all(req.params.id);
    const results = questions.map((q: any) => ({
      question_id: q.id,
      options: db.prepare("SELECT o.id, o.text, COUNT(v.id) as count FROM options o LEFT JOIN votes v ON o.id = v.option_id WHERE o.question_id = ? GROUP BY o.id").all(q.id)
    }));
    res.json(results);
  });

  // Admin Routes
  app.get("/api/users", (req, res) => {
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(req.query.admin_id);
    if (!admin?.is_admin) return res.status(403).json({ error: "Unauthorized" });
    res.json(db.prepare("SELECT id, username, full_name, phone, email, is_admin, is_blocked FROM users").all());
  });

  app.put("/api/users/:id/block", (req, res) => {
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(req.body.admin_id);
    if (!admin?.is_admin) return res.status(403).json({ error: "Unauthorized" });
    db.prepare("UPDATE users SET is_blocked = ? WHERE id = ?").run(req.body.is_blocked ? 1 : 0, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/users/:id", (req, res) => {
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(req.query.admin_id);
    if (!admin?.is_admin) return res.status(403).json({ error: "Unauthorized" });
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.put("/api/users/:id", (req, res) => {
    const { full_name, phone, email, avatar } = req.body;
    db.prepare("UPDATE users SET full_name = ?, phone = ?, email = ?, avatar = ? WHERE id = ?").run(full_name, phone, email, avatar, req.params.id);
    res.json({ success: true, user: db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) });
  });

  // Vite / Static
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();