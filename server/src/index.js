const path = require('path');
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DB_PATH = process.env.DB_PATH || './server/data/class-score.db';

const resolvedDbPath = path.resolve(process.cwd(), DB_PATH);
fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });

const db = new DatabaseSync(resolvedDbPath);

function getLevel(points) {
  const safePoints = Math.max(0, Number(points || 0));
  const level = Math.floor(Math.sqrt(safePoints / 5));
  const currentFloor = 5 * level * level;
  const nextFloor = 5 * (level + 1) * (level + 1);
  const denominator = nextFloor - currentFloor;
  const progress = denominator > 0 ? ((safePoints - currentFloor) / denominator) * 100 : 100;

  return {
    level,
    progress: Math.min(100, Math.max(0, progress)),
    currentFloor,
    nextFloor
  };
}

function toStudentRow(row) {
  const calc = getLevel(row.points);
  return {
    id: row.id,
    name: row.name,
    points: row.points,
    level: calc.level,
    progressPercent: Number(calc.progress.toFixed(3)),
    nextLevelAt: calc.nextFloor
  };
}

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS score_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
  const columns = db.prepare("PRAGMA table_info('students')").all();
  const hasLevel = columns.some((col) => col.name === 'level');
  if (!hasLevel) {
    db.exec('ALTER TABLE students ADD COLUMN level INTEGER NOT NULL DEFAULT 0');
  }

  const updateLevelStmt = db.prepare('UPDATE students SET level = ? WHERE id = ?');
  const allRows = db.prepare('SELECT id, points FROM students').all();
  for (const row of allRows) {
    updateLevelStmt.run(getLevel(row.points).level, row.id);
  }

  if (count === 0) {
    const names = [
      'Alice', 'Ben', 'Cathy', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
      'Kelly', 'Leo', 'Mia', 'Noah', 'Olivia', 'Peter', 'Queenie', 'Ryan', 'Sophie', 'Tom'
    ];
    const insert = db.prepare('INSERT INTO students (name, points) VALUES (?, ?)');
    const seed = () => {
      db.exec('BEGIN');
      for (const name of names) {
        insert.run(name, 0);
      }
      db.exec('COMMIT');
    };
    try {
      seed();
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

initDb();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/admin', express.static(path.resolve(process.cwd(), 'admin')));
app.use('/client', express.static(path.resolve(process.cwd(), 'client')));

app.get('/', (req, res) => {
  res.redirect('/client');
});

const activeTokens = new Set();

function isAuthed(req) {
  if (!ADMIN_PASSWORD) {
    return true;
  }

  const token = req.header('x-admin-token');
  return Boolean(token && activeTokens.has(token));
}

function requireAdmin(req, res, next) {
  if (isAuthed(req)) {
    return next();
  }

  return res.status(401).json({ message: 'Unauthorized admin action.' });
}

app.get('/api/config', (req, res) => {
  res.json({
    passwordRequired: Boolean(ADMIN_PASSWORD),
    defaultReasons: ['Homework Excellence', 'Quiz Excellence', 'Homework Missing', 'Vocabulary Not Met']
  });
});

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.json({ token: 'open-mode' });
  }

  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Wrong password.' });
  }

  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  activeTokens.add(token);

  setTimeout(() => activeTokens.delete(token), 12 * 60 * 60 * 1000);

  return res.json({ token });
});

app.get('/api/students', (req, res) => {
  const rows = db.prepare('SELECT id, name, points FROM students ORDER BY points DESC, name ASC').all();
  const students = rows.map(toStudentRow);
  res.json({ students, updatedAt: new Date().toISOString() });
});

app.get('/api/students/:id/logs', (req, res) => {
  const studentId = Number(req.params.id);
  if (Number.isNaN(studentId)) {
    return res.status(400).json({ message: 'Invalid student id.' });
  }

  const student = db.prepare('SELECT id, name, points FROM students WHERE id = ?').get(studentId);
  if (!student) {
    return res.status(404).json({ message: 'Student not found.' });
  }

  const logs = db.prepare(`
    SELECT id, delta, reason, note, created_at AS createdAt
    FROM score_logs
    WHERE student_id = ?
    ORDER BY id DESC
    LIMIT 200
  `).all(studentId);

  return res.json({ student: toStudentRow(student), logs });
});

app.post('/api/students/:id/score', requireAdmin, (req, res) => {
  const studentId = Number(req.params.id);
  const delta = Number(req.body?.delta);
  const reason = (req.body?.reason || '').trim();
  const note = (req.body?.note || '').trim();

  if (Number.isNaN(studentId) || !Number.isInteger(studentId)) {
    return res.status(400).json({ message: 'Invalid student id.' });
  }

  if (Number.isNaN(delta) || !Number.isInteger(delta) || delta === 0 || delta < -100 || delta > 100) {
    return res.status(400).json({ message: 'Delta must be an integer between -100 and 100, excluding 0.' });
  }

  if (!reason) {
    return res.status(400).json({ message: 'Reason is required.' });
  }

  const student = db.prepare('SELECT id, name, points FROM students WHERE id = ?').get(studentId);
  if (!student) {
    return res.status(404).json({ message: 'Student not found.' });
  }

  const nextPoints = Math.max(0, student.points + delta);
  const actualDelta = nextPoints - student.points;
  const nextLevel = getLevel(nextPoints).level;

  const write = () => {
    db.exec('BEGIN');
    db.prepare('UPDATE students SET points = ?, level = ? WHERE id = ?').run(nextPoints, nextLevel, studentId);
    const info = db.prepare(
      'INSERT INTO score_logs (student_id, delta, reason, note) VALUES (?, ?, ?, ?)'
    ).run(studentId, actualDelta, reason, note || null);

    const updated = db.prepare('SELECT id, name, points FROM students WHERE id = ?').get(studentId);
    const log = db.prepare('SELECT id, delta, reason, note, created_at AS createdAt FROM score_logs WHERE id = ?').get(Number(info.lastInsertRowid));
    db.exec('COMMIT');

    return { updated, log };
  };

  let result;
  try {
    result = write();
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  const payload = {
    type: 'score_updated',
    student: toStudentRow(result.updated),
    log: result.log,
    timestamp: new Date().toISOString()
  };

  broadcast(payload);

  return res.json(payload);
});

app.get('/api/summary/top', (req, res) => {
  const topRows = db.prepare('SELECT id, name, points FROM students ORDER BY points DESC, name ASC LIMIT 10').all();
  return res.json({
    top: topRows.map(toStudentRow)
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
});

server.listen(PORT, () => {
  console.log(`Class score server running on http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin`);
  console.log(`Client page: http://localhost:${PORT}/client`);
});
