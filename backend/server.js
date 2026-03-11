// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Sert le frontend en production ───
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Routes API ───
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/couples', require('./routes/couples'));
app.use('/api/answers', require('./routes/answers'));

// ─── Health check ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Fallback → index.html ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ CoupleQuest backend démarré sur http://localhost:${PORT}`);
});
