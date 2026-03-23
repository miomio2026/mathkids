import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, StatusBar, Animated, Dimensions, Vibration,
} from 'react-native';

const { width: W } = Dimensions.get('window');

// ── Colori per categoria ─────────────────────────────────────────
const COLORS = {
  add:  { bg: '#FF6B6B', light: '#FFE0E0', dark: '#C94B4B', emoji: '➕' },
  sub:  { bg: '#4ECDC4', light: '#D6F5F3', dark: '#2DAA9E', emoji: '➖' },
  mul:  { bg: '#FFD93D', light: '#FFF7CC', dark: '#CCA800', emoji: '✖️' },
  div:  { bg: '#6BCB77', light: '#D6F5DB', dark: '#3E8E49', emoji: '➗' },
  expr: { bg: '#A78BFA', light: '#EDE9FE', dark: '#6D28D9', emoji: '🧮' },
};

// ── Livelli ──────────────────────────────────────────────────────
const LEVELS = [
  { id: 'easy',   label: 'Facile',    emoji: '⭐',      range: [1, 10],  exprLen: 2 },
  { id: 'medium', label: 'Medio',     emoji: '⭐⭐',    range: [1, 20],  exprLen: 3 },
  { id: 'hard',   label: 'Difficile', emoji: '⭐⭐⭐',  range: [1, 50],  exprLen: 4 },
];

const TOTAL_ROUNDS = 10;

// ── Helpers ──────────────────────────────────────────────────────
function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Scompone l'espressione in "termini additivi" risolvendo prima × e ÷
// Restituisce null se una divisione non è esatta
function parseAdditiveTerms(nums, ops) {
  const terms = [];
  let val = nums[0];
  let pendingOp = null;
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === 'mul') {
      val *= nums[i + 1];
    } else if (ops[i] === 'div') {
      if (nums[i + 1] === 0 || val % nums[i + 1] !== 0) return null;
      val = val / nums[i + 1];
    } else {
      terms.push({ val, op: pendingOp });
      pendingOp = ops[i];
      val = nums[i + 1];
    }
  }
  terms.push({ val, op: pendingOp });
  return terms;
}

// Calcola il risultato finale e controlla che NESSUNA somma parziale sia negativa
function evalTerms(terms) {
  let running = 0;
  for (const t of terms) {
    running = (t.op === 'sub') ? running - t.val : running + t.val;
    if (running < 0) return null; // somma parziale negativa → scarta
  }
  return running;
}

function generateQuestion(type, level, exprOps) {
  const [min, max] = level.range;
  const numMax = Math.min(max, 15);

  switch (type) {
    case 'add': {
      const a = rnd(min, max), b = rnd(min, max);
      return { text: `${a} + ${b} = ?`, answer: a + b };
    }
    case 'sub': {
      const a = rnd(min, max), b = rnd(0, a);
      return { text: `${a} − ${b} = ?`, answer: a - b };
    }
    case 'mul': {
      const a = rnd(1, Math.min(max, 12)), b = rnd(1, Math.min(max, 12));
      return { text: `${a} × ${b} = ?`, answer: a * b };
    }
    case 'div': {
      const b = rnd(1, Math.min(max, 10));
      const a = b * rnd(1, Math.min(max, 10));
      return { text: `${a} ÷ ${b} = ?`, answer: a / b };
    }
    case 'expr': {
      const ops = exprOps.length ? exprOps : ['add'];
      const symMap = { add: '+', sub: '−', mul: '×', div: '÷' };
      const targetLen = Math.max(level.exprLen - 1, ops.length);

      for (let attempt = 0; attempt < 500; attempt++) {
        // Sequenza operatori con tutte le ops selezionate almeno una volta
        let opSeq = shuffle([...ops]);
        while (opSeq.length < targetLen) opSeq.push(ops[rnd(0, ops.length - 1)]);
        opSeq = opSeq.slice(0, targetLen);

        // Genera i numeri
        const nums = Array.from({ length: opSeq.length + 1 }, () => rnd(1, numMax));

        // Per ogni ÷ non in catena, forza il dividendo divisibile
        for (let i = 0; i < opSeq.length; i++) {
          if (opSeq[i] === 'div') {
            const divisor = rnd(2, 9);
            nums[i + 1] = divisor;
            if (i === 0 || (opSeq[i - 1] !== 'mul' && opSeq[i - 1] !== 'div')) {
              nums[i] = divisor * rnd(1, Math.floor(numMax / divisor) || 1);
            }
          }
        }

        // Scomponi in termini additivi
        const terms = parseAdditiveTerms([...nums], [...opSeq]);
        if (!terms) continue;

        // Controlla che nessuna somma parziale sia negativa
        const result = evalTerms(terms);
        if (result === null || !Number.isInteger(result)) continue;

        // Tutto ok: costruisci la stringa
        let expr = `${nums[0]}`;
        for (let i = 0; i < opSeq.length; i++) {
          expr += ` ${symMap[opSeq[i]]} ${nums[i + 1]}`;
        }
        return { text: `${expr} = ?`, answer: result };
      }

      // Fallback sicuro
      const a = rnd(min, max), b = rnd(min, max);
      return { text: `${a} + ${b} = ?`, answer: a + b };
    }
    default:
      return { text: '1 + 1 = ?', answer: 2 };
  }
}

function generateChoices(answer) {
  const s = new Set([answer]);
  while (s.size < 4) {
    const c = answer + rnd(-10, 10);
    if (c !== answer && c >= 0) s.add(c);
  }
  return [...s].sort(() => Math.random() - 0.5);
}

// ── Componenti ───────────────────────────────────────────────────
function Hearts({ lives }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2].map(i => (
        <Text key={i} style={{ fontSize: 22, opacity: i < lives ? 1 : 0.25 }}>❤️</Text>
      ))}
    </View>
  );
}

function ProgressBar({ value, color }) {
  return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── App principale ───────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]   = useState('home');
  const [category, setCategory] = useState(null);
  const [level, setLevel]     = useState(LEVELS[0]);
  const [exprOps, setExprOps] = useState(['add', 'sub']);
  const [question, setQuestion] = useState(null);
  const [choices, setChoices] = useState([]);
  const [score, setScore]     = useState(0);
  const [lives, setLives]     = useState(3);
  const [round, setRound]     = useState(0);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong'
  const [time, setTime]       = useState(0);
  const [streak, setStreak]   = useState(0);
  const [history, setHistory] = useState([]);
  const timerRef = useRef(null);
  const feedbackTimeout = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const color = category ? COLORS[category] : COLORS.add;


  // Timer
  useEffect(() => {
    if (screen === 'game') {
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (screen !== 'result') setTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  const nextQuestion = useCallback(() => {
    const q = generateQuestion(category, level, exprOps);
    setQuestion(q);
    setChoices(generateChoices(q.answer));
    setFeedback(null);
  }, [category, level, exprOps]);

  const startGame = () => {
    setScore(0); setLives(3); setRound(0); setStreak(0); setHistory([]);
    setScreen('game');
  };

  useEffect(() => {
    if (screen === 'game') nextQuestion();
  }, [screen]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleAnswer = (choice) => {
    if (feedback) return;
    const correct = choice === question.answer;
    const newStreak = correct ? streak + 1 : 0;
    const bonus = correct && newStreak >= 3 ? 20 : correct ? 10 : 0;
    const newScore = score + bonus;
    const newLives = correct ? lives : lives - 1;
    setFeedback(correct ? 'correct' : 'wrong');
    setStreak(newStreak);
    setScore(newScore);
    setLives(newLives);
    setHistory(h => [...h, { text: question.text, answer: question.answer, given: choice, correct }]);
    if (correct) {
      Vibration.vibrate([0, 80, 60, 80]); // doppio tap = risposta giusta
    } else {
      Vibration.vibrate(400);             // vibrazione lunga = sbagliato
      shake();
    }
    feedbackTimeout.current = setTimeout(() => {
      const newRound = round + 1;
      if (newRound >= TOTAL_ROUNDS || newLives <= 0) {
        setRound(newRound);
        setScreen('result');
      } else {
        setRound(newRound);
        nextQuestion();
      }
    }, 1000);
  };

  // ── HOME ─────────────────────────────────────────────────────────
  if (screen === 'home') return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#EFF6FF' }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.center}>
        <Text style={styles.logoText}>🧮</Text>
        <Text style={styles.appTitle}>MathKids</Text>
        <Text style={styles.appSubtitle}>Scegli una categoria!</Text>
        <View style={styles.catGrid}>
          {[
            { id: 'add', label: 'Addizioni' },
            { id: 'sub', label: 'Sottrazioni' },
            { id: 'mul', label: 'Moltiplicazioni' },
            { id: 'div', label: 'Divisioni' },
          ].map(cat => (
            <TouchableOpacity key={cat.id}
              style={[styles.catBtn, { backgroundColor: COLORS[cat.id].bg }]}
              activeOpacity={0.8}
              onPress={() => { setCategory(cat.id); setScreen('level'); }}>
              <Text style={{ fontSize: 36 }}>{COLORS[cat.id].emoji}</Text>
              <Text style={styles.catLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Espressioni - full width */}
        <TouchableOpacity
          style={[styles.catBtnFull, { backgroundColor: COLORS.expr.bg }]}
          activeOpacity={0.8}
          onPress={() => { setCategory('expr'); setScreen('config'); }}>
          <Text style={{ fontSize: 36 }}>{COLORS.expr.emoji}</Text>
          <Text style={styles.catLabel}>Espressioni</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── CONFIG ESPRESSIONI ───────────────────────────────────────────
  if (screen === 'config') return (
    <SafeAreaView style={[styles.root, { backgroundColor: COLORS.expr.light }]}>
      <ScrollView contentContainerStyle={styles.panel}>
        <TouchableOpacity onPress={() => setScreen('home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={[styles.panelTitle, { color: COLORS.expr.dark }]}>🧮 Configura Espressioni</Text>
        <Text style={styles.hint}>Seleziona le operazioni da includere:</Text>
        <View style={styles.toggleGrid}>
          {[
            { id: 'add', label: 'Addizione',       sym: '+' },
            { id: 'sub', label: 'Sottrazione',     sym: '−' },
            { id: 'mul', label: 'Moltiplicazione', sym: '×' },
            { id: 'div', label: 'Divisione',       sym: '÷' },
          ].map(op => {
            const on = exprOps.includes(op.id);
            return (
              <TouchableOpacity key={op.id}
                style={[styles.toggleBtn, { backgroundColor: on ? COLORS[op.id].bg : '#E5E7EB' }]}
                onPress={() => setExprOps(prev =>
                  on && prev.length > 1 ? prev.filter(x => x !== op.id) : on ? prev : [...prev, op.id]
                )}>
                <Text style={{ fontSize: 28 }}>{op.sym}</Text>
                <Text style={[styles.toggleLabel, { color: on ? '#fff' : '#6B7280' }]}>{op.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: COLORS.expr.bg }]} onPress={() => setScreen('level')}>
          <Text style={styles.primaryBtnText}>Continua →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── LIVELLO ──────────────────────────────────────────────────────
  if (screen === 'level') return (
    <SafeAreaView style={[styles.root, { backgroundColor: color.light }]}>
      <ScrollView contentContainerStyle={styles.panel}>
        <TouchableOpacity onPress={() => setScreen(category === 'expr' ? 'config' : 'home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={[styles.panelTitle, { color: color.dark }]}>{color.emoji} Scegli il livello</Text>
        {LEVELS.map(lv => (
          <TouchableOpacity key={lv.id}
            style={[styles.levelBtn, {
              borderColor: level.id === lv.id ? color.dark : 'transparent',
              backgroundColor: level.id === lv.id ? color.light : '#F9FAFB',
            }]}
            onPress={() => setLevel(lv)}>
            <Text style={{ fontSize: 24 }}>{lv.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.levelTitle, { color: color.dark }]}>{lv.label}</Text>
              <Text style={styles.levelSub}>Numeri fino a {lv.range[1]}</Text>
            </View>
            {level.id === lv.id && <Text style={{ fontSize: 20 }}>✅</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: color.bg, marginTop: 16 }]} onPress={startGame}>
          <Text style={styles.primaryBtnText}>Inizia! 🚀</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── GIOCO ────────────────────────────────────────────────────────
  if (screen === 'game' && question) return (
    <SafeAreaView style={[styles.root, { backgroundColor: color.light }]}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <Hearts lives={lives} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.scoreLabel}>PUNTEGGIO</Text>
          <Text style={[styles.scoreValue, { color: color.dark }]}>{score}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 18 }}>⏱</Text>
          <Text style={styles.timerText}>{time}s</Text>
        </View>
      </View>

      {/* Progress */}
      <ProgressBar value={(round / TOTAL_ROUNDS) * 100} color={color.bg} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 }}>
        <Text style={styles.roundText}>Domanda {round + 1} di {TOTAL_ROUNDS}</Text>
        {streak >= 3 && <Text style={styles.streakText}>🔥 Serie x{streak}!</Text>}
      </View>

      {/* Domanda */}
      <Animated.View style={[styles.questionCard, { borderColor: color.bg, transform: [{ translateX: shakeAnim }] }]}>
        <Text style={{ fontSize: 36 }}>{color.emoji}</Text>
        <Text style={[styles.questionText, { color: color.dark }]}>{question.text}</Text>
      </Animated.View>

      {/* Risposte */}
      <View style={styles.choicesGrid}>
        {choices.map((c, i) => {
          let bg = '#FFFFFF';
          if (feedback) {
            if (c === question.answer) bg = '#6BCB77';
            else if (feedback === 'wrong') bg = '#FF6B6B33';
          }
          return (
            <TouchableOpacity key={i}
              style={[styles.choiceBtn, { backgroundColor: bg, borderColor: feedback && c === question.answer ? '#3E8E49' : '#E5E7EB' }]}
              activeOpacity={0.75}
              onPress={() => handleAnswer(c)}>
              <Text style={styles.choiceText}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Feedback */}
      {feedback && (
        <View style={[styles.feedbackBar, { backgroundColor: feedback === 'correct' ? '#6BCB77' : '#FF6B6B' }]}>
          <Text style={styles.feedbackText}>
            {feedback === 'correct' ? '✅ Corretto! Bravo!' : `❌ La risposta era ${question.answer}`}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.quitBtn} onPress={() => setScreen('home')}>
        <Text style={styles.quitText}>✕ Esci</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  // ── RISULTATI ────────────────────────────────────────────────────
  if (screen === 'result') {
    const correct = history.filter(h => h.correct).length;
    const pct = Math.round((correct / history.length) * 100);
    const medal = pct === 100 ? '🥇' : pct >= 70 ? '🥈' : '🥉';
    const msg   = pct === 100 ? 'Perfetto! Sei un genio!' : pct >= 70 ? 'Ottimo lavoro!' : 'Continua ad allenarti!';
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: color.light }]}>
        <ScrollView contentContainerStyle={styles.panel}>
          <Text style={{ fontSize: 72, textAlign: 'center' }}>{medal}</Text>
          <Text style={[styles.panelTitle, { color: color.dark, textAlign: 'center' }]}>{msg}</Text>

          {/* Statistiche */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: color.bg + '33' }]}>
              <Text style={{ fontSize: 24 }}>⭐</Text>
              <Text style={[styles.statValue, { color: color.dark }]}>{score}</Text>
              <Text style={styles.statLabel}>Punti</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#6BCB7733' }]}>
              <Text style={{ fontSize: 24 }}>✅</Text>
              <Text style={[styles.statValue, { color: '#3E8E49' }]}>{correct}/{history.length}</Text>
              <Text style={styles.statLabel}>Corrette</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#4ECDC433' }]}>
              <Text style={{ fontSize: 24 }}>⏱</Text>
              <Text style={[styles.statValue, { color: '#2DAA9E' }]}>{time}s</Text>
              <Text style={styles.statLabel}>Tempo</Text>
            </View>
          </View>

          {/* Riepilogo */}
          <Text style={styles.recapTitle}>Riepilogo domande:</Text>
          {history.map((h, i) => (
            <View key={i} style={[styles.recapRow, { backgroundColor: h.correct ? '#D1FAE5' : '#FEE2E2' }]}>
              <Text style={styles.recapQ}>{h.text.replace('= ?', `= ${h.answer}`)}</Text>
              <Text style={{ fontSize: 16 }}>{h.correct ? '✅' : `❌ (${h.given})`}</Text>
            </View>
          ))}

          {/* Pulsanti */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: color.bg, flex: 1 }]} onPress={startGame}>
              <Text style={styles.primaryBtnText}>🔁 Rigioca</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#6B7280', flex: 1 }]} onPress={() => setScreen('home')}>
              <Text style={styles.primaryBtnText}>🏠 Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

// ── Stili ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:           { flex: 1 },
  center:         { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  panel:          { padding: 20 },

  // Home
  logoText:       { fontSize: 64, marginTop: 8 },
  appTitle:       { fontSize: 38, fontWeight: '900', color: '#1E3A5F', marginTop: 4, letterSpacing: -1 },
  appSubtitle:    { fontSize: 16, color: '#6B7280', marginBottom: 20 },
  catGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  catBtn:         { width: (W - 56) / 2, height: 110, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  catBtnFull:     { width: W - 32, height: 90, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  catLabel:       { fontWeight: '800', fontSize: 14, color: '#fff', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  // Panel comune
  backBtn:        { marginBottom: 12 },
  backText:       { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  panelTitle:     { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  hint:           { fontSize: 14, color: '#6B7280', marginBottom: 14 },
  primaryBtn:     { borderRadius: 16, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  // Config
  toggleGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  toggleBtn:      { width: (W - 58) / 2, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  toggleLabel:    { fontWeight: '700', fontSize: 13 },

  // Livello
  levelBtn:       { flexDirection: 'row', alignItems: 'center', borderWidth: 3, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  levelTitle:     { fontWeight: '800', fontSize: 18 },
  levelSub:       { fontSize: 13, color: '#6B7280' },

  // Game
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  scoreLabel:     { fontSize: 10, color: '#6B7280', fontWeight: '700' },
  scoreValue:     { fontSize: 22, fontWeight: '900' },
  timerText:      { fontSize: 16, fontWeight: '700', color: '#374151' },
  progressWrap:   { height: 10, backgroundColor: '#E5E7EB', marginHorizontal: 16, borderRadius: 99, overflow: 'hidden', marginBottom: 4 },
  progressFill:   { height: '100%', borderRadius: 99 },
  roundText:      { fontSize: 12, color: '#6B7280' },
  streakText:     { fontSize: 12, color: '#F59E0B', fontWeight: '800' },
  questionCard:   { margin: 16, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', gap: 8, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 12, elevation: 5 },
  questionText:   { fontWeight: '900', fontSize: 30, textAlign: 'center' },
  choicesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  choiceBtn:      { width: (W - 56) / 2, borderRadius: 16, borderWidth: 2, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  choiceText:     { fontWeight: '900', fontSize: 26, color: '#1F2937' },
  feedbackBar:    { margin: 16, borderRadius: 14, padding: 12, alignItems: 'center' },
  feedbackText:   { color: '#fff', fontWeight: '800', fontSize: 16 },
  quitBtn:        { alignItems: 'center', marginTop: 4 },
  quitText:       { fontSize: 14, color: '#9CA3AF', fontWeight: '700' },

  // Risultati
  statsRow:       { flexDirection: 'row', gap: 10, marginVertical: 16 },
  statBox:        { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 2 },
  statValue:      { fontSize: 26, fontWeight: '900' },
  statLabel:      { fontSize: 12, color: '#6B7280' },
  recapTitle:     { fontWeight: '800', fontSize: 14, color: '#374151', marginBottom: 8 },
  recapRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: 8, marginBottom: 6 },
  recapQ:         { fontSize: 13, color: '#374151', flex: 1 },
});
      return { text: `${a} + ${b} = ?`, answer: a + b };
    }
    case 'sub': {
      const a = rnd(min, max), b = rnd(0, a);
      return { text: `${a} − ${b} = ?`, answer: a - b };
    }
    case 'mul': {
      const a = rnd(1, Math.min(max, 12)), b = rnd(1, Math.min(max, 12));
      return { text: `${a} × ${b} = ?`, answer: a * b };
    }
    case 'div': {
      const b = rnd(1, Math.min(max, 10));
      const a = b * rnd(1, Math.min(max, 10));
      return { text: `${a} ÷ ${b} = ?`, answer: a / b };
    }
    case 'expr': {
      const ops = exprOps.length ? exprOps : ['add'];
      const symMap = { add: '+', sub: '−', mul: '×', div: '÷' };
      const targetLen = Math.max(level.exprLen - 1, ops.length);

      // Tenta fino a 300 volte di generare un'espressione valida
      for (let attempt = 0; attempt < 300; attempt++) {
        // Sequenza operatori: tutte le ops selezionate almeno una volta, in ordine casuale
        let opSeq = shuffle([...ops]);
        while (opSeq.length < targetLen) opSeq.push(ops[rnd(0, ops.length - 1)]);
        opSeq = opSeq.slice(0, targetLen);

        // Genera i numeri
        const nums = Array.from({ length: opSeq.length + 1 }, () => rnd(1, numMax));

        // Per ogni ÷, aggiusta la coppia affinché la divisione sia esatta.
        // Bisogna considerare che × e ÷ vengono calcolati prima:
        // se l'operatore i-esimo è ÷, il dividendo "reale" è il risultato
        // della catena di × e ÷ che precede. Per semplicità, se il precedente
        // operatore NON è × o ÷, il dividendo reale è nums[i].
        // In quel caso lo forziamo divisibile. Altrimenti lasciamo al retry.
        for (let i = 0; i < opSeq.length; i++) {
          if (opSeq[i] === 'div') {
            const divisor = rnd(2, 9);
            nums[i + 1] = divisor;
            // se non è in catena con l'operatore precedente, forza nums[i] divisibile
            if (i === 0 || (opSeq[i - 1] !== 'mul' && opSeq[i - 1] !== 'div')) {
              nums[i] = divisor * rnd(1, Math.floor(numMax / divisor) || 1);
            }
          }
        }

        // Calcola con la precedenza corretta
        const result = evalWithPrecedence([...nums], [...opSeq]);

        // Valida: risultato intero e non negativo
        if (Number.isInteger(result) && result >= 0) {
          let expr = `${nums[0]}`;
          for (let i = 0; i < opSeq.length; i++) {
            expr += ` ${symMap[opSeq[i]]} ${nums[i + 1]}`;
          }
          return { text: `${expr} = ?`, answer: result };
        }
      }

      // Fallback sicuro se non trova soluzione
      const a = rnd(min, max), b = rnd(min, max);
      return { text: `${a} + ${b} = ?`, answer: a + b };
    }
    default:
      return { text: '1 + 1 = ?', answer: 2 };
  }
}

function generateChoices(answer) {
  const s = new Set([answer]);
  while (s.size < 4) {
    const c = answer + rnd(-10, 10);
    if (c !== answer && c >= 0) s.add(c);
  }
  return [...s].sort(() => Math.random() - 0.5);
}

// ── Componenti ───────────────────────────────────────────────────
function Hearts({ lives }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[0, 1, 2].map(i => (
        <Text key={i} style={{ fontSize: 22, opacity: i < lives ? 1 : 0.25 }}>❤️</Text>
      ))}
    </View>
  );
}

function ProgressBar({ value, color }) {
  return (
    <View style={styles.progressWrap}>
      <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── App principale ───────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]   = useState('home');
  const [category, setCategory] = useState(null);
  const [level, setLevel]     = useState(LEVELS[0]);
  const [exprOps, setExprOps] = useState(['add', 'sub']);
  const [question, setQuestion] = useState(null);
  const [choices, setChoices] = useState([]);
  const [score, setScore]     = useState(0);
  const [lives, setLives]     = useState(3);
  const [round, setRound]     = useState(0);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong'
  const [time, setTime]       = useState(0);
  const [streak, setStreak]   = useState(0);
  const [history, setHistory] = useState([]);
  const timerRef = useRef(null);
  const feedbackTimeout = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const color = category ? COLORS[category] : COLORS.add;


  // Timer
  useEffect(() => {
    if (screen === 'game') {
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (screen !== 'result') setTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [screen]);

  const nextQuestion = useCallback(() => {
    const q = generateQuestion(category, level, exprOps);
    setQuestion(q);
    setChoices(generateChoices(q.answer));
    setFeedback(null);
  }, [category, level, exprOps]);

  const startGame = () => {
    setScore(0); setLives(3); setRound(0); setStreak(0); setHistory([]);
    setScreen('game');
  };

  useEffect(() => {
    if (screen === 'game') nextQuestion();
  }, [screen]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleAnswer = (choice) => {
    if (feedback) return;
    const correct = choice === question.answer;
    const newStreak = correct ? streak + 1 : 0;
    const bonus = correct && newStreak >= 3 ? 20 : correct ? 10 : 0;
    const newScore = score + bonus;
    const newLives = correct ? lives : lives - 1;
    setFeedback(correct ? 'correct' : 'wrong');
    setStreak(newStreak);
    setScore(newScore);
    setLives(newLives);
    setHistory(h => [...h, { text: question.text, answer: question.answer, given: choice, correct }]);
    if (correct) {
      Vibration.vibrate([0, 80, 60, 80]); // doppio tap = risposta giusta
    } else {
      Vibration.vibrate(400);             // vibrazione lunga = sbagliato
      shake();
    }
    feedbackTimeout.current = setTimeout(() => {
      const newRound = round + 1;
      if (newRound >= TOTAL_ROUNDS || newLives <= 0) {
        setRound(newRound);
        setScreen('result');
      } else {
        setRound(newRound);
        nextQuestion();
      }
    }, 1000);
  };

  // ── HOME ─────────────────────────────────────────────────────────
  if (screen === 'home') return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#EFF6FF' }]}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.center}>
        <Text style={styles.logoText}>🧮</Text>
        <Text style={styles.appTitle}>MathKids</Text>
        <Text style={styles.appSubtitle}>Scegli una categoria!</Text>
        <View style={styles.catGrid}>
          {[
            { id: 'add', label: 'Addizioni' },
            { id: 'sub', label: 'Sottrazioni' },
            { id: 'mul', label: 'Moltiplicazioni' },
            { id: 'div', label: 'Divisioni' },
          ].map(cat => (
            <TouchableOpacity key={cat.id}
              style={[styles.catBtn, { backgroundColor: COLORS[cat.id].bg }]}
              activeOpacity={0.8}
              onPress={() => { setCategory(cat.id); setScreen('level'); }}>
              <Text style={{ fontSize: 36 }}>{COLORS[cat.id].emoji}</Text>
              <Text style={styles.catLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Espressioni - full width */}
        <TouchableOpacity
          style={[styles.catBtnFull, { backgroundColor: COLORS.expr.bg }]}
          activeOpacity={0.8}
          onPress={() => { setCategory('expr'); setScreen('config'); }}>
          <Text style={{ fontSize: 36 }}>{COLORS.expr.emoji}</Text>
          <Text style={styles.catLabel}>Espressioni</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── CONFIG ESPRESSIONI ───────────────────────────────────────────
  if (screen === 'config') return (
    <SafeAreaView style={[styles.root, { backgroundColor: COLORS.expr.light }]}>
      <ScrollView contentContainerStyle={styles.panel}>
        <TouchableOpacity onPress={() => setScreen('home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={[styles.panelTitle, { color: COLORS.expr.dark }]}>🧮 Configura Espressioni</Text>
        <Text style={styles.hint}>Seleziona le operazioni da includere:</Text>
        <View style={styles.toggleGrid}>
          {[
            { id: 'add', label: 'Addizione',       sym: '+' },
            { id: 'sub', label: 'Sottrazione',     sym: '−' },
            { id: 'mul', label: 'Moltiplicazione', sym: '×' },
            { id: 'div', label: 'Divisione',       sym: '÷' },
          ].map(op => {
            const on = exprOps.includes(op.id);
            return (
              <TouchableOpacity key={op.id}
                style={[styles.toggleBtn, { backgroundColor: on ? COLORS[op.id].bg : '#E5E7EB' }]}
                onPress={() => setExprOps(prev =>
                  on && prev.length > 1 ? prev.filter(x => x !== op.id) : on ? prev : [...prev, op.id]
                )}>
                <Text style={{ fontSize: 28 }}>{op.sym}</Text>
                <Text style={[styles.toggleLabel, { color: on ? '#fff' : '#6B7280' }]}>{op.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: COLORS.expr.bg }]} onPress={() => setScreen('level')}>
          <Text style={styles.primaryBtnText}>Continua →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── LIVELLO ──────────────────────────────────────────────────────
  if (screen === 'level') return (
    <SafeAreaView style={[styles.root, { backgroundColor: color.light }]}>
      <ScrollView contentContainerStyle={styles.panel}>
        <TouchableOpacity onPress={() => setScreen(category === 'expr' ? 'config' : 'home')} style={styles.backBtn}>
          <Text style={styles.backText}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={[styles.panelTitle, { color: color.dark }]}>{color.emoji} Scegli il livello</Text>
        {LEVELS.map(lv => (
          <TouchableOpacity key={lv.id}
            style={[styles.levelBtn, {
              borderColor: level.id === lv.id ? color.dark : 'transparent',
              backgroundColor: level.id === lv.id ? color.light : '#F9FAFB',
            }]}
            onPress={() => setLevel(lv)}>
            <Text style={{ fontSize: 24 }}>{lv.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.levelTitle, { color: color.dark }]}>{lv.label}</Text>
              <Text style={styles.levelSub}>Numeri fino a {lv.range[1]}</Text>
            </View>
            {level.id === lv.id && <Text style={{ fontSize: 20 }}>✅</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: color.bg, marginTop: 16 }]} onPress={startGame}>
          <Text style={styles.primaryBtnText}>Inizia! 🚀</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );

  // ── GIOCO ────────────────────────────────────────────────────────
  if (screen === 'game' && question) return (
    <SafeAreaView style={[styles.root, { backgroundColor: color.light }]}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        <Hearts lives={lives} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.scoreLabel}>PUNTEGGIO</Text>
          <Text style={[styles.scoreValue, { color: color.dark }]}>{score}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 18 }}>⏱</Text>
          <Text style={styles.timerText}>{time}s</Text>
        </View>
      </View>

      {/* Progress */}
      <ProgressBar value={(round / TOTAL_ROUNDS) * 100} color={color.bg} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 4 }}>
        <Text style={styles.roundText}>Domanda {round + 1} di {TOTAL_ROUNDS}</Text>
        {streak >= 3 && <Text style={styles.streakText}>🔥 Serie x{streak}!</Text>}
      </View>

      {/* Domanda */}
      <Animated.View style={[styles.questionCard, { borderColor: color.bg, transform: [{ translateX: shakeAnim }] }]}>
        <Text style={{ fontSize: 36 }}>{color.emoji}</Text>
        <Text style={[styles.questionText, { color: color.dark }]}>{question.text}</Text>
      </Animated.View>

      {/* Risposte */}
      <View style={styles.choicesGrid}>
        {choices.map((c, i) => {
          let bg = '#FFFFFF';
          if (feedback) {
            if (c === question.answer) bg = '#6BCB77';
            else if (feedback === 'wrong') bg = '#FF6B6B33';
          }
          return (
            <TouchableOpacity key={i}
              style={[styles.choiceBtn, { backgroundColor: bg, borderColor: feedback && c === question.answer ? '#3E8E49' : '#E5E7EB' }]}
              activeOpacity={0.75}
              onPress={() => handleAnswer(c)}>
              <Text style={styles.choiceText}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Feedback */}
      {feedback && (
        <View style={[styles.feedbackBar, { backgroundColor: feedback === 'correct' ? '#6BCB77' : '#FF6B6B' }]}>
          <Text style={styles.feedbackText}>
            {feedback === 'correct' ? '✅ Corretto! Bravo!' : `❌ La risposta era ${question.answer}`}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.quitBtn} onPress={() => setScreen('home')}>
        <Text style={styles.quitText}>✕ Esci</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  // ── RISULTATI ────────────────────────────────────────────────────
  if (screen === 'result') {
    const correct = history.filter(h => h.correct).length;
    const pct = Math.round((correct / history.length) * 100);
    const medal = pct === 100 ? '🥇' : pct >= 70 ? '🥈' : '🥉';
    const msg   = pct === 100 ? 'Perfetto! Sei un genio!' : pct >= 70 ? 'Ottimo lavoro!' : 'Continua ad allenarti!';
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: color.light }]}>
        <ScrollView contentContainerStyle={styles.panel}>
          <Text style={{ fontSize: 72, textAlign: 'center' }}>{medal}</Text>
          <Text style={[styles.panelTitle, { color: color.dark, textAlign: 'center' }]}>{msg}</Text>

          {/* Statistiche */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: color.bg + '33' }]}>
              <Text style={{ fontSize: 24 }}>⭐</Text>
              <Text style={[styles.statValue, { color: color.dark }]}>{score}</Text>
              <Text style={styles.statLabel}>Punti</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#6BCB7733' }]}>
              <Text style={{ fontSize: 24 }}>✅</Text>
              <Text style={[styles.statValue, { color: '#3E8E49' }]}>{correct}/{history.length}</Text>
              <Text style={styles.statLabel}>Corrette</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#4ECDC433' }]}>
              <Text style={{ fontSize: 24 }}>⏱</Text>
              <Text style={[styles.statValue, { color: '#2DAA9E' }]}>{time}s</Text>
              <Text style={styles.statLabel}>Tempo</Text>
            </View>
          </View>

          {/* Riepilogo */}
          <Text style={styles.recapTitle}>Riepilogo domande:</Text>
          {history.map((h, i) => (
            <View key={i} style={[styles.recapRow, { backgroundColor: h.correct ? '#D1FAE5' : '#FEE2E2' }]}>
              <Text style={styles.recapQ}>{h.text.replace('= ?', `= ${h.answer}`)}</Text>
              <Text style={{ fontSize: 16 }}>{h.correct ? '✅' : `❌ (${h.given})`}</Text>
            </View>
          ))}

          {/* Pulsanti */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: color.bg, flex: 1 }]} onPress={startGame}>
              <Text style={styles.primaryBtnText}>🔁 Rigioca</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#6B7280', flex: 1 }]} onPress={() => setScreen('home')}>
              <Text style={styles.primaryBtnText}>🏠 Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

// ── Stili ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:           { flex: 1 },
  center:         { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  panel:          { padding: 20 },

  // Home
  logoText:       { fontSize: 64, marginTop: 8 },
  appTitle:       { fontSize: 38, fontWeight: '900', color: '#1E3A5F', marginTop: 4, letterSpacing: -1 },
  appSubtitle:    { fontSize: 16, color: '#6B7280', marginBottom: 20 },
  catGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
  catBtn:         { width: (W - 56) / 2, height: 110, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  catBtnFull:     { width: W - 32, height: 90, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  catLabel:       { fontWeight: '800', fontSize: 14, color: '#fff', textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  // Panel comune
  backBtn:        { marginBottom: 12 },
  backText:       { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  panelTitle:     { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  hint:           { fontSize: 14, color: '#6B7280', marginBottom: 14 },
  primaryBtn:     { borderRadius: 16, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  primaryBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },

  // Config
  toggleGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  toggleBtn:      { width: (W - 58) / 2, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  toggleLabel:    { fontWeight: '700', fontSize: 13 },

  // Livello
  levelBtn:       { flexDirection: 'row', alignItems: 'center', borderWidth: 3, borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  levelTitle:     { fontWeight: '800', fontSize: 18 },
  levelSub:       { fontSize: 13, color: '#6B7280' },

  // Game
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  scoreLabel:     { fontSize: 10, color: '#6B7280', fontWeight: '700' },
  scoreValue:     { fontSize: 22, fontWeight: '900' },
  timerText:      { fontSize: 16, fontWeight: '700', color: '#374151' },
  progressWrap:   { height: 10, backgroundColor: '#E5E7EB', marginHorizontal: 16, borderRadius: 99, overflow: 'hidden', marginBottom: 4 },
  progressFill:   { height: '100%', borderRadius: 99 },
  roundText:      { fontSize: 12, color: '#6B7280' },
  streakText:     { fontSize: 12, color: '#F59E0B', fontWeight: '800' },
  questionCard:   { margin: 16, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', gap: 8, borderWidth: 3, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 12, elevation: 5 },
  questionText:   { fontWeight: '900', fontSize: 30, textAlign: 'center' },
  choicesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  choiceBtn:      { width: (W - 56) / 2, borderRadius: 16, borderWidth: 2, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  choiceText:     { fontWeight: '900', fontSize: 26, color: '#1F2937' },
  feedbackBar:    { margin: 16, borderRadius: 14, padding: 12, alignItems: 'center' },
  feedbackText:   { color: '#fff', fontWeight: '800', fontSize: 16 },
  quitBtn:        { alignItems: 'center', marginTop: 4 },
  quitText:       { fontSize: 14, color: '#9CA3AF', fontWeight: '700' },

  // Risultati
  statsRow:       { flexDirection: 'row', gap: 10, marginVertical: 16 },
  statBox:        { flex: 1, borderRadius: 16, padding: 12, alignItems: 'center', gap: 2 },
  statValue:      { fontSize: 26, fontWeight: '900' },
  statLabel:      { fontSize: 12, color: '#6B7280' },
  recapTitle:     { fontWeight: '800', fontSize: 14, color: '#374151', marginBottom: 8 },
  recapRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, padding: 8, marginBottom: 6 },
  recapQ:         { fontSize: 13, color: '#374151', flex: 1 },
});
