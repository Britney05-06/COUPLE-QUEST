// backend/routes/couples.js
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../db');
const auth = require('../middleware/auth');

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// POST /api/couples/create
router.post('/create', auth, async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('couples')
      .select('id')
      .or(`user1_id.eq.${req.user.id},user2_id.eq.${req.user.id}`)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Tu es déjà dans un couple' });
    }

    let code, exists = true;
    while (exists) {
      code = generateCode();
      const { data } = await supabase.from('couples').select('id').eq('code', code).single();
      exists = !!data;
    }

    const { data: couple, error } = await supabase
      .from('couples')
      .insert({ code, user1_id: req.user.id })
      .select('id, code, user1_id, user2_id, created_at')
      .single();

    if (error) throw error;
    res.status(201).json({ couple });
  } catch (err) {
    console.error('Create couple error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/couples/join
router.post('/join', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code requis' });

    const { data: couple, error } = await supabase
      .from('couples')
      .select('id, code, user1_id, user2_id')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !couple) {
      return res.status(404).json({ error: 'Code invalide ou introuvable' });
    }
    if (couple.user2_id) {
      return res.status(409).json({ error: 'Ce couple est déjà complet' });
    }
    if (couple.user1_id === req.user.id) {
      return res.status(400).json({ error: 'Tu ne peux pas rejoindre ton propre couple !' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('couples')
      .update({ user2_id: req.user.id })
      .eq('id', couple.id)
      .select(`
        id, code, created_at,
        user1:users!couples_user1_id_fkey(id, prenom, photo_url),
        user2:users!couples_user2_id_fkey(id, prenom, photo_url)
      `)
      .single();

    if (updateError) throw updateError;
    res.json({ couple: updated });
  } catch (err) {
    console.error('Join couple error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/couples/me
router.get('/me', auth, async (req, res) => {
  try {
    const { data: couple, error } = await supabase
      .from('couples')
      .select(`
        id, code, created_at,
        user1:users!couples_user1_id_fkey(id, prenom, photo_url),
        user2:users!couples_user2_id_fkey(id, prenom, photo_url)
      `)
      .or(`user1_id.eq.${req.user.id},user2_id.eq.${req.user.id}`)
      .single();

    if (error || !couple) {
      return res.status(404).json({ error: 'Aucun couple trouvé' });
    }

    const { data: answers } = await supabase
      .from('answers')
      .select('user_id')
      .eq('couple_id', couple.id);

    const respondents = [...new Set((answers || []).map(a => a.user_id))];
    const user1Done = couple.user1 && respondents.includes(couple.user1.id);
    const user2Done = couple.user2 && respondents.includes(couple.user2.id);

    res.json({ couple, status: { user1Done, user2Done, bothDone: user1Done && user2Done } });
  } catch (err) {
    console.error('Get couple error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

// ─── Quitter le couple ───
router.delete('/leave', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data: couple } = await db
      .from('couples')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (!couple) return res.status(404).json({ error: 'Couple introuvable' });

    // Supprimer les réponses et lettres du couple
    await db.from('answers').delete().eq('couple_id', couple.id);
    await db.from('letters').delete().eq('couple_id', couple.id);
    await db.from('couples').delete().eq('id', couple.id);

    res.json({ success: true });
  } catch (err) {
    console.error('Leave couple error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
