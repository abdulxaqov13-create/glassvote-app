import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Resend } from "resend";

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

// Migration: Add is_admin column to users if it doesn't exist
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

// Migration: Ensure questions table exists and options has question_id
try {
  const tableInfo = db.prepare("PRAGMA table_info(options)").all();
  const hasQuestionId = tableInfo.some((col: any) => col.name === 'question_id');
  if (!hasQuestionId) {
    // If it's the old schema, it's safer to just clear these tables for the new structure
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

// Seed Database with Admin and User
try {
  const insertUser = db.prepare("INSERT INTO users (username, password, full_name, phone, email, is_admin) VALUES (?, ?, ?, ?, ?, ?)");
  
  // Check and Create Admin
  const adminExists = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
  if (!adminExists) {
    insertUser.run("admin", "admin123", "Asosiy Admin", "+998901234567", "admin@glassvote.uz", 1);
    console.log("Admin created: admin / admin123");
  }
  
  // Check and Create Regular User
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
  app.use(express.json());

  // Auth Routes
  app.post("/api/auth/send-code", async (req, res) => {
    const { email } = req.body;
    if (!resend) {
      return res.status(500).json({ error: "Email xizmati sozlanmagan." });
    }

    if (!email) {
      return res.status(400).json({ error: "Email manzili kiritilmagan." });
    }

    const recipientEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    try {
      console.log(`Attempting to send verification code to: ${recipientEmail}`);
      db.prepare("DELETE FROM verification_codes WHERE email = ?").run(recipientEmail);
      db.prepare("INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)").run(recipientEmail, code, expiresAt);

      // Resend validation_error often occurs due to 'from' field format or unverified recipients
      // Using plain 'onboarding@resend.dev' is the most reliable for the free tier
      const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: recipientEmail,
        subject: 'GlassVote: Tasdiqlash kodi',
        html: `<p>Sizning tasdiqlash kodingiz: <strong>${code}</strong>. Kod 5 daqiqa davomida amal qiladi.</p>`
      });

      if (error) {
        console.error("Resend API Error Detail:", JSON.stringify(error, null, 2));
        return res.status(400).json({ 
          error: `Email yuborishda xatolik (${error.name}): ${error.message}. ` + 
                 (error.name === 'validation_error' ? "Iltimos, Resend dashboard'ida tasdiqlangan email manzilingizdan foydalaning." : "")
        });
      }

      console.log("Email sent successfully:", data);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Server Error during email send:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/auth/register", (req, res) => {
    const { username, password, full_name, phone, email, code } = req.body;
    try {
      if (!email || !code) {
        console.error("Missing email or code in register request:", { email, code });
        return res.status(400).json({ error: "Email yoki tasdiqlash kodi yetishmayapti." });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = code.toString().trim();
      const now = new Date().toISOString();

      console.log(`Verifying code for ${normalizedEmail}: input_code=${normalizedCode}, now=${now}`);

      // Verify code
      const verification = db.prepare("SELECT * FROM verification_codes WHERE email = ? AND code = ? AND expires_at > ?").get(normalizedEmail, normalizedCode, now);
      
      if (!verification) {
        const anyCode = db.prepare("SELECT * FROM verification_codes WHERE email = ?").get(normalizedEmail);
        if (anyCode) {
          console.log(`Code found but mismatch or expired: stored_code=${anyCode.code}, expires_at=${anyCode.expires_at}, now=${now}`);
        } else {
          console.log(`No code found for email: ${normalizedEmail}`);
          // List all codes for debugging (be careful with sensitive data in real apps)
          const allCodes = db.prepare("SELECT email FROM verification_codes").all();
          console.log("Current emails with codes in DB:", allCodes.map(c => c.email));
        }
        return res.status(400).json({ error: "Tasdiqlash kodi noto'g'ri yoki muddati o'tgan." });
      }

      // Check if username already exists
      const existingUsername = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
      if (existingUsername) {
        return res.status(400).json({ error: "Ushbu foydalanuvchi nomi allaqachon band." });
      }

      // Check if email already exists
      const existingEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
      if (existingEmail) {
        return res.status(400).json({ error: "Ushbu email manzili allaqachon ro'yxatdan o'tgan." });
      }

      const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
      const isAdmin = userCount === 0 ? 1 : 0;
      
      const info = db.prepare("INSERT INTO users (username, password, full_name, phone, email, is_admin) VALUES (?, ?, ?, ?, ?, ?)").run(username, password, full_name, phone, normalizedEmail, isAdmin);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
      
      db.prepare("DELETE FROM verification_codes WHERE email = ?").run(normalizedEmail);

      sendTelegramMessage(`🆕 *Yangi foydalanuvchi ro'yxatdan o'tdi!*${isAdmin ? " (ADMIN)" : ""}\n\n👤 Ism: ${full_name}\n📞 Tel: ${phone}\n📧 Email: ${email}\n🕒 Vaqt: ${new Date().toLocaleString()}`);
      
      res.json({ success: true, user });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      if (user.is_blocked) {
        return res.status(403).json({ error: "Sizning hisobingiz bloklangan." });
      }
      res.json({ success: true, user });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.delete("/api/users/me", (req, res) => {
    const userId = req.headers['user-id'];
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
      const db_transaction = db.transaction(() => {
        // Delete user's votes
        db.prepare("DELETE FROM votes WHERE user_id = ?").run(userId);
        
        // Delete user's surveys (and their questions/options)
        const userSurveys = db.prepare("SELECT id FROM surveys WHERE creator_id = ?").all(userId);
        for (const survey of userSurveys) {
          const questions = db.prepare("SELECT id FROM questions WHERE survey_id = ?").all(survey.id);
          for (const question of questions) {
            db.prepare("DELETE FROM options WHERE question_id = ?").run(question.id);
          }
          db.prepare("DELETE FROM questions WHERE survey_id = ?").run(survey.id);
          db.prepare("DELETE FROM votes WHERE survey_id = ?").run(survey.id);
          db.prepare("DELETE FROM surveys WHERE id = ?").run(survey.id);
        }

        // Finally delete the user
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      });

      db_transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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
    
    const surveysWithQuestions = surveys.map((s: any) => {
      const questions = db.prepare("SELECT * FROM questions WHERE survey_id = ?").all(s.id);
      const questionsWithOptions = questions.map((q: any) => ({
        ...q,
        options: db.prepare("SELECT * FROM options WHERE question_id = ?").all(q.id)
      }));
      return { ...s, questions: questionsWithOptions };
    });
    
    res.json(surveysWithQuestions);
  });

  app.post("/api/surveys", (req, res) => {
    const { title, description, image_url, creator_id, questions } = req.body;
    
    // Admin check
    const user = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(creator_id);
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: "Faqat adminlar so'rovnoma qo'sha oladi." });
    }

    const transaction = db.transaction(() => {
      const info = db.prepare("INSERT INTO surveys (title, description, image_url, creator_id) VALUES (?, ?, ?, ?)").run(title, description, image_url, creator_id);
      const surveyId = info.lastInsertRowid;
      
      const insertQuestion = db.prepare("INSERT INTO questions (survey_id, text) VALUES (?, ?)");
      const insertOption = db.prepare("INSERT INTO options (question_id, text) VALUES (?, ?)");
      
      for (const q of questions) {
        const qInfo = insertQuestion.run(surveyId, q.text);
        const questionId = qInfo.lastInsertRowid;
        for (const opt of q.options) {
          insertOption.run(questionId, opt);
        }
      }
      return surveyId;
    });

    try {
      const surveyId = transaction();
      const creator = db.prepare("SELECT full_name FROM users WHERE id = ?").get(creator_id);
      
      sendTelegramMessage(`📊 *Yangi so'rovnoma yaratildi!*\n\n📝 Nomi: ${title}\n👤 Yaratuvchi: ${creator.full_name}\n❓ Savollar soni: ${questions.length}\n🕒 Vaqt: ${new Date().toLocaleString()}`);
      
      res.json({ success: true, id: surveyId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/surveys/:id", (req, res) => {
    const surveyId = req.params.id;
    const { admin_id } = req.query;

    console.log(`Delete request for survey ${surveyId} from admin ${admin_id}`);

    if (!admin_id) {
      return res.status(401).json({ error: "Admin ID yetishmayapti." });
    }

    const user = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(Number(admin_id));
    if (!user || !user.is_admin) {
      console.warn(`Unauthorized delete attempt: user=${admin_id}, is_admin=${user?.is_admin}`);
      return res.status(403).json({ error: "Faqat adminlar so'rovnomani o'chira oladi." });
    }

    try {
      const deleteTx = db.transaction((id: any) => {
        db.prepare("DELETE FROM votes WHERE survey_id = ?").run(id);
        db.prepare("DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE survey_id = ?)").run(id);
        db.prepare("DELETE FROM questions WHERE survey_id = ?").run(id);
        db.prepare("DELETE FROM surveys WHERE id = ?").run(id);
      });
      
      deleteTx(Number(surveyId));
      console.log(`Survey ${surveyId} deleted successfully`);
      res.json({ success: true });
    } catch (e: any) {
      console.error("Delete survey error:", e);
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/surveys/:id", (req, res) => {
    const surveyId = req.params.id;
    const { title, description, image_url, admin_id, questions } = req.body;

    const user = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(admin_id);
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: "Faqat adminlar so'rovnomani tahrirlay oladi." });
    }

    try {
      db.transaction(() => {
        db.prepare("UPDATE surveys SET title = ?, description = ?, image_url = ? WHERE id = ?").run(title, description, image_url, surveyId);
        
        if (questions) {
          // Simplest way: delete and re-insert questions/options
          // Note: This will break existing votes if question/option IDs change.
          // For a more robust app, we should match by ID, but for this remix, 
          // we'll warn or just accept it. Actually, let's just update title/desc for now
          // to avoid breaking votes, OR we can try to be smarter.
          // User request is broad, let's stick to title/desc for simplicity OR 
          // if they really want to edit questions, we do the nuclear option.
          
          // Let's do nuclear for now but warn in UI if votes exist? 
          // Actually, let's just update title/desc if votes exist, otherwise full edit.
          const voteCount = db.prepare("SELECT COUNT(*) as count FROM votes WHERE survey_id = ?").get(surveyId).count;
          if (voteCount === 0) {
            db.prepare("DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE survey_id = ?)").run(surveyId);
            db.prepare("DELETE FROM questions WHERE survey_id = ?").run(surveyId);
            
            const insertQuestion = db.prepare("INSERT INTO questions (survey_id, text) VALUES (?, ?)");
            const insertOption = db.prepare("INSERT INTO options (question_id, text) VALUES (?, ?)");
            
            for (const q of questions) {
              const qInfo = insertQuestion.run(surveyId, q.text);
              const questionId = qInfo.lastInsertRowid;
              for (const opt of q.options) {
                insertOption.run(questionId, opt);
              }
            }
          }
        }
      })();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/surveys/:id/vote", (req, res) => {
    const { user_id, votes } = req.body; // votes: [{ question_id, option_id }]
    const survey_id = req.params.id;
    
    const transaction = db.transaction(() => {
      const insertVote = db.prepare("INSERT INTO votes (user_id, survey_id, question_id, option_id) VALUES (?, ?, ?, ?)");
      for (const v of votes) {
        insertVote.run(user_id, survey_id, v.question_id, v.option_id);
      }
    });

    try {
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: "Siz allaqachon ba'zi savollarga ovoz bergansiz yoki xatolik yuz berdi." });
    }
  });

  app.get("/api/surveys/:id/results", (req, res) => {
    const survey_id = req.params.id;
    const questions = db.prepare("SELECT * FROM questions WHERE survey_id = ?").all(survey_id);
    
    const results = questions.map((q: any) => {
      const options = db.prepare(`
        SELECT o.id, o.text, COUNT(v.id) as count
        FROM options o
        LEFT JOIN votes v ON o.id = v.option_id
        WHERE o.question_id = ?
        GROUP BY o.id
      `).all(q.id);
      return { question_id: q.id, question_text: q.text, options };
    });
    
    res.json(results);
  });

  // Profile Routes
  app.get("/api/users", (req, res) => {
    const { admin_id } = req.query;
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(admin_id);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: "Ruxsat berilmagan." });
    }
    const users = db.prepare("SELECT id, username, full_name, phone, email, is_admin, is_blocked FROM users").all();
    res.json(users);
  });

  app.delete("/api/users/:id", (req, res) => {
    const { admin_id } = req.query;
    const targetId = req.params.id;
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(admin_id);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: "Ruxsat berilmagan." });
    }
    if (Number(targetId) === Number(admin_id)) {
      return res.status(400).json({ error: "O'zingizni o'chira olmaysiz." });
    }
    try {
      const db_transaction = db.transaction(() => {
        // Delete user's votes
        db.prepare("DELETE FROM votes WHERE user_id = ?").run(targetId);
        
        // Delete user's surveys (and their questions/options)
        const userSurveys = db.prepare("SELECT id FROM surveys WHERE creator_id = ?").all(targetId);
        for (const survey of userSurveys) {
          const questions = db.prepare("SELECT id FROM questions WHERE survey_id = ?").all(survey.id);
          for (const question of questions) {
            db.prepare("DELETE FROM options WHERE question_id = ?").run(question.id);
          }
          db.prepare("DELETE FROM questions WHERE survey_id = ?").run(survey.id);
          db.prepare("DELETE FROM votes WHERE survey_id = ?").run(survey.id);
          db.prepare("DELETE FROM surveys WHERE id = ?").run(survey.id);
        }

        // Finally delete the user
        db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
      });

      db_transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/users/:id/block", (req, res) => {
    const { admin_id, is_blocked } = req.body;
    const targetId = req.params.id;
    const admin = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(admin_id);
    if (!admin || !admin.is_admin) {
      return res.status(403).json({ error: "Ruxsat berilmagan." });
    }
    if (Number(targetId) === Number(admin_id)) {
      return res.status(400).json({ error: "O'zingizni bloklay olmaysiz." });
    }
    try {
      db.prepare("UPDATE users SET is_blocked = ? WHERE id = ?").run(is_blocked ? 1 : 0, targetId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/users/:id", (req, res) => {
    const { full_name, phone, email, avatar } = req.body;
    const id = req.params.id;
    try {
      db.prepare("UPDATE users SET full_name = ?, phone = ?, email = ?, avatar = ? WHERE id = ?").run(full_name, phone, email, avatar, id);
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
      res.json({ success: true, user });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
