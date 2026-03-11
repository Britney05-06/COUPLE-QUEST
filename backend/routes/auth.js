// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const supabase = require('../db');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptées'));
  }
});

// POST /api/auth/register
router.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { prenom, email, password } = req.body;
    if (!prenom || !email || !password) {
      return res.status(400).json({ error: 'Prénom, email et mot de passe requis' });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    let photo_url = null;
    if (req.file) {
      const ext = req.file.mimetype.split('/')[1];
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, req.file.buffer, { contentType: req.file.mimetype });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filename);
        photo_url = urlData.publicUrl;
      }
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({ prenom, email: email.toLowerCase(), password_hash, photo_url })
      .select('id, prenom, email, photo_url')
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: user.id, email: user.email, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: user.id, prenom: user.prenom, email: user.email, photo_url: user.photo_url } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, prenom, email, password_hash, photo_url')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, prenom: user.prenom },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, prenom: user.prenom, email: user.email, photo_url: user.photo_url } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, prenom, email, photo_url')
      .eq('id', req.user.id)
      .single();

    if (error || !user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
