const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Sauvegarder les réponses + lettre ───
router.post('/', auth, async (req, res) => {
  try {
    const { answers, letter } = req.body;
    const userId = req.user.id;

    const { data: couple } = await db
      .from('couples')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (!couple) return res.status(404).json({ error: 'Couple introuvable' });

    // Supprimer les anciennes réponses
    await db.from('answers').delete()
      .eq('couple_id', couple.id)
      .eq('user_id', userId);

    // Insérer les nouvelles
    const rows = Object.entries(answers).map(([question_id, answer]) => ({
      couple_id: couple.id,
      user_id: userId,
      question_id,
      answer: String(answer)
    }));

    if (rows.length > 0) {
      await db.from('answers').insert(rows);
    }

    // Sauvegarder la lettre
    if (letter !== undefined) {
      await db.from('letters').delete()
        .eq('couple_id', couple.id)
        .eq('from_user_id', userId);

      if (letter.trim()) {
        await db.from('letters').insert({
          couple_id: couple.id,
          from_user_id: userId,
          content: letter
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Answers error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Récupérer les réponses + analyse IA ───
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: couple } = await db
      .from('couples')
      .select('*, user1:user1_id(id,prenom,photo_url), user2:user2_id(id,prenom,photo_url)')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .single();

    if (!couple) return res.status(404).json({ error: 'Couple introuvable' });
    if (!couple.user1_id || !couple.user2_id) return res.status(400).json({ error: 'Le couple n\'est pas complet' });

    // Récupérer les réponses des deux
    const { data: allAnswers } = await db
      .from('answers')
      .select('*')
      .eq('couple_id', couple.id);

    const { data: allLetters } = await db
      .from('letters')
      .select('*')
      .eq('couple_id', couple.id);

    const buildUser = (user) => {
      const userAnswers = {};
      (allAnswers || [])
        .filter(a => a.user_id === user.id)
        .forEach(a => { userAnswers[a.question_id] = a.answer; });
      const letter = (allLetters || []).find(l => l.from_user_id === user.id);
      return { ...user, answers: userAnswers, letter: letter?.content || '' };
    };

    const user1Data = buildUser(couple.user1);
    const user2Data = buildUser(couple.user2);

    // ─── Analyse IA ───
    let aiAnalysis = null;
    try {
      aiAnalysis = await analyzeWithAI(user1Data, user2Data);
    } catch (aiErr) {
      console.error('AI analysis failed:', aiErr);
    }

    res.json({ user1: user1Data, user2: user2Data, aiAnalysis });
  } catch (err) {
    console.error('Get answers error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Analyse IA ───
async function analyzeWithAI(user1, user2) {
  const textQuestions = [
    { id: 'n1', q: 'En 3 mots, notre relation c\'est…' },
    { id: 'n2', q: 'Le souvenir qui te fait sourire' },
    { id: 'n5', q: 'Ce que la relation t\'a appris' },
    { id: 'n6', q: 'Ce que tu aurais fait différemment' },
    { id: 'c2', q: 'Sujet qu\'on évite' },
    { id: 'c4', q: 'Ce qui t\'aiderait à te sentir entendu·e' },
    { id: 'c7', q: 'Ce que tu voulais dire depuis longtemps' },
    { id: 'c8', q: 'Ce que je fais qui te blesse' },
    { id: 'a1', q: 'Dans 5 ans j\'aimerais qu\'on soit…' },
    { id: 'a2', q: 'Ce que tu ne sais pas concilier avec la relation' },
    { id: 'a3', q: 'La grande question à aborder' },
    { id: 'a4', q: 'Ce qui te ferait rester' },
    { id: 'a5', q: 'Ce que tu voudrais que je change' },
    { id: 'a6', q: 'La répartition des rôles' },
    { id: 'a8', q: 'Dans combien de temps pour les enfants' },
    { id: 'a10', q: 'Dans combien de temps pour le mariage' },
    { id: 'o1', q: 'Nos limites' },
    { id: 'o3', q: 'Ce dont tu as besoin pour être heureux·se' },
    { id: 'o4', q: 'Ce que tu retiens contre moi' },
    { id: 'o5', q: 'Ta promesse' },
  ];

  const chipQuestions = [
    { id: 'c1', q: 'Quand je suis blessé·e' },
    { id: 'c6', q: 'Mon langage de l\'amour' },
    { id: 'a7', q: 'Enfants' },
    { id: 'a9', q: 'Mariage' },
  ];

  const scaleQuestions = [
    { id: 'n4', q: 'Je me sens moi-même dans la relation (1-10)' },
    { id: 'c3', q: 'Je me sens libre de dire ce qui me dérange (1-10)' },
    { id: 'c5', q: 'On se dit suffisamment ce qu\'on apprécie (1-10)' },
    { id: 'o2', q: 'On se choisit encore chaque jour (1-10)' },
  ];

  let prompt = `Tu es un expert en psychologie des couples. Analyse les réponses de deux partenaires à un quiz de couple et fournis une analyse approfondie en JSON.

Voici les réponses :

=== QUESTIONS TEXTE LIBRE ===\n`;

  textQuestions.forEach(({ id, q }) => {
    const r1 = user1.answers[id] || '(pas de réponse)';
    const r2 = user2.answers[id] || '(pas de réponse)';
    prompt += `\n${q}\n- ${user1.prenom}: ${r1}\n- ${user2.prenom}: ${r2}\n`;
  });

  prompt += `\n=== CHOIX MULTIPLES ===\n`;
  chipQuestions.forEach(({ id, q }) => {
    const r1 = user1.answers[id] || '(pas de réponse)';
    const r2 = user2.answers[id] || '(pas de réponse)';
    prompt += `\n${q}\n- ${user1.prenom}: ${r1}\n- ${user2.prenom}: ${r2}\n`;
  });

  prompt += `\n=== ÉCHELLES ===\n`;
  scaleQuestions.forEach(({ id, q }) => {
    const r1 = user1.answers[id] || '?';
    const r2 = user2.answers[id] || '?';
    prompt += `\n${q}\n- ${user1.prenom}: ${r1}/10\n- ${user2.prenom}: ${r2}/10\n`;
  });

  prompt += `

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks, sans texte avant ou après. Format exact :
{
  "summary": "Résumé chaleureux et honnête de la relation en 2-3 phrases",
  "strengths": [
    {"title": "titre court", "description": "explication 1-2 phrases"}
  ],
  "watchPoints": [
    {"title": "titre court", "description": "explication 1-2 phrases", "severity": "low|medium|high"}
  ],
  "insights": [
    {"person": "${user1.prenom}|${user2.prenom}|Les deux", "text": "insight personnalisé"}
  ],
  "actionItems": [
    "action concrète à faire ensemble"
  ]
}

strengths: 3-4 points forts réels basés sur les réponses
watchPoints: 2-4 points de vigilance honnêtes, classés par sévérité
insights: 3-4 observations personnalisées sur chaque personne ou le couple
actionItems: 3 actions concrètes et spécifiques à faire cette semaine`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = message.content[0].text.trim();
  return JSON.parse(text);
}

module.exports = router;
