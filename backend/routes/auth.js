const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('../db');
const auth = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ─── Register ───
router.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { prenom, email, password } = req.body;
    if (!prenom || !email || !password)
      return res.status(400).json({ error: 'Champs manquants' });

    const { data: existing } = await db.from('users').select('id').eq('email', email).single();
    if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });

    const password_hash = await bcrypt.hash(password, 10);

    let photo_url = null;
    if (req.file) {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;
      const { error: uploadError } = await db.storage
        .from('avatars')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
      if (!uploadError) {
        const { data: urlData } = db.storage.from('avatars').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }

    const { data: user, error } = await db.from('users')
      .insert({ prenom, email, password_hash, photo_url })
      .select('id, prenom, email, photo_url')
      .single();

    if (error) throw error;

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Login ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email et mot de passe requis' });

    const { data: user } = await db.from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Me ───
router.get('/me', auth, async (req, res) => {
  try {
    const { data: user } = await db.from('users')
      .select('id, prenom, email, photo_url')
      .eq('id', req.user.id)
      .single();
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Modifier le profil ───
router.patch('/me', auth, upload.single('photo'), async (req, res) => {
  try {
    const { prenom, email, password } = req.body;
    const updates = {};

    if (prenom) updates.prenom = prenom;
    if (email) {
      const { data: existing } = await db.from('users')
        .select('id').eq('email', email).neq('id', req.user.id).single();
      if (existing) return res.status(400).json({ error: 'Email déjà utilisé' });
      updates.email = email;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });
      updates.password_hash = await bcrypt.hash(password, 10);
    }

    if (req.file) {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${req.file.mimetype.split('/')[1]}`;
      const { error: uploadError } = await db.storage
        .from('avatars')
        .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });
      if (!uploadError) {
        const { data: urlData } = db.storage.from('avatars').getPublicUrl(fileName);
        updates.photo_url = urlData.publicUrl;
      }
    }

    const { data: user, error } = await db.from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, prenom, email, photo_url')
      .single();

    if (error) throw error;
    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Supprimer le compte ───
router.delete('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer le couple
    const { data: couple } = await db.from('couples')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (couple) {
      // Si user1 supprime → supprimer le couple entier
      // Si user2 supprime → juste le détacher
      if (couple.user1_id === userId) {
        await db.from('couples').delete().eq('id', couple.id);
      } else {
        await db.from('couples').update({ user2_id: null }).eq('id', couple.id);
      }
    }

    await db.from('answers').delete().eq('user_id', userId);
    await db.from('letters').delete().eq('from_user_id', userId);
    await db.from('users').delete().eq('id', userId);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
