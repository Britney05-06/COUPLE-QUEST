// backend/routes/answers.js
const express = require('express');
const router = express.Router();
const supabase = require('../db');
const auth = require('../middleware/auth');

// POST /api/answers
router.post('/', auth, async (req, res) => {
  try {
    const { answers, letter } = req.body;
    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ error: 'Réponses invalides' });
    }

    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${req.user.id},user2_id.eq.${req.user.id}`)
      .single();

    if (coupleError || !couple) {
      return res.status(404).json({ error: 'Aucun couple trouvé' });
    }

    await supabase
      .from('answers')
      .delete()
      .eq('couple_id', couple.id)
      .eq('user_id', req.user.id);

    const rows = Object.entries(answers).map(([question_id, answer]) => ({
      couple_id: couple.id,
      user_id: req.user.id,
      question_id,
      answer: String(answer)
    }));

    const { error: insertError } = await supabase.from('answers').insert(rows);
    if (insertError) throw insertError;

    if (letter !== undefined) {
      await supabase.from('letters').delete()
        .eq('couple_id', couple.id)
        .eq('from_user_id', req.user.id);

      if (letter.trim()) {
        await supabase.from('letters').insert({
          couple_id: couple.id,
          from_user_id: req.user.id,
          content: letter
        });
      }
    }

    res.json({ success: true, count: rows.length });
  } catch (err) {
    console.error('Save answers error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/answers
router.get('/', auth, async (req, res) => {
  try {
    const { data: couple, error: coupleError } = await supabase
      .from('couples')
      .select(`
        id,
        user1:users!couples_user1_id_fkey(id, prenom, photo_url),
        user2:users!couples_user2_id_fkey(id, prenom, photo_url)
      `)
      .or(`user1_id.eq.${req.user.id},user2_id.eq.${req.user.id}`)
      .single();

    if (coupleError || !couple) {
      return res.status(404).json({ error: 'Aucun couple trouvé' });
    }
    if (!couple.user2) {
      return res.status(403).json({ error: 'Ton/ta partenaire n\'a pas encore rejoint' });
    }

    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('user_id, question_id, answer')
      .eq('couple_id', couple.id);

    if (answersError) throw answersError;

    const respondents = [...new Set(answers.map(a => a.user_id))];
    const user1Done = respondents.includes(couple.user1.id);
    const user2Done = respondents.includes(couple.user2.id);

    if (!user1Done || !user2Done) {
      return res.status(403).json({
        error: 'Les deux partenaires doivent avoir répondu avant la révélation',
        status: { user1Done, user2Done }
      });
    }

    const byUser = {};
    answers.forEach(a => {
      if (!byUser[a.user_id]) byUser[a.user_id] = {};
      byUser[a.user_id][a.question_id] = a.answer;
    });

    const { data: letters } = await supabase
      .from('letters')
      .select('from_user_id, content')
      .eq('couple_id', couple.id);

    const lettersByUser = {};
    (letters || []).forEach(l => { lettersByUser[l.from_user_id] = l.content; });

    res.json({
      couple,
      user1: { ...couple.user1, answers: byUser[couple.user1.id] || {}, letter: lettersByUser[couple.user1.id] || '' },
      user2: { ...couple.user2, answers: byUser[couple.user2.id] || {}, letter: lettersByUser[couple.user2.id] || '' },
    });
  } catch (err) {
    console.error('Get answers error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
