/**
 * TOM AI — Local Knowledge Brain
 * ------------------------------------------------------------------
 * A client-side fallback "brain" so TOM AI can answer general chess
 * questions, rules, openings, tactics, study tips, greetings and
 * small-talk even when the server-side Gemini key is not configured.
 *
 * Priority order used by the chat handlers:
 *   1. Server /api/ai  (Gemini, if configured — best, full context)
 *   2. If the server only returns its generic "default" template OR the
 *      query is clearly general-knowledge/chess/conversational, we answer
 *      locally with window.tomLocalAnswer().
 *
 * This keeps live academy-data answers (students, finances, attendance)
 * flowing through the server, while guaranteeing chess & conversational
 * questions always get a useful, portal-appropriate reply.
 */
(function () {
  'use strict';

  // Markers that indicate the server gave its "I don't really know" template.
  const SERVER_DEFAULT_MARKERS = [
    'Training Operations Manager**\n\nI\'m connected',
    'TOM AI — Parent Portal**\n\nI can help you track',
    'Welcome to TOM AI** — the Training Operations Manager',
    'My calculations are complete',
    "couldn't process that request"
  ];

  window.tomServerGaveDefault = function (text) {
    if (!text) return true;
    return SERVER_DEFAULT_MARKERS.some(m => text.includes(m));
  };

  // ── Knowledge base ────────────────────────────────────────────────
  // Each entry: keywords (any match), and an answer (markdown string).
  // Ordered roughly by specificity; the matcher scores by keyword hits.
  const KB = [
    {
      id: 'identity',
      keys: ['who are you', 'what are you', 'your name', 'what can you do', 'what do you do', 'help me with', 'capabilities'],
      a: () => `🤖 **I'm TOM AI** — the Training Operations Manager for **Chesskidoo Academy**.\n\nI can help with:\n• **Chess knowledge** — openings, tactics, rules, endgames, study tips\n• **Your portal** — ${roleScope()}\n\nJust ask me anything, like *"Explain the Sicilian Defense"* or *"How is my child progressing?"*`
    },
    {
      id: 'greeting',
      keys: ['hello', 'hi ', 'hey', 'good morning', 'good evening', 'good afternoon', 'greetings', 'namaste', 'how are you', "what's up", 'whats up'],
      a: () => `👋 **Hello!** I'm TOM AI, your Chesskidoo assistant. I'm doing great and ready to help.\n\nYou can ask me about chess (openings, tactics, rules) or about ${roleScope()} How can I help today?`
    },
    {
      id: 'thanks',
      keys: ['thank', 'thanks', 'thx', 'appreciate', 'awesome', 'great job', 'well done'],
      a: () => `You're most welcome! 😊 Happy to help anytime. Feel free to ask another chess question or check on your academy data.`
    },
    {
      id: 'elo',
      keys: ['elo', 'rating system', 'what is rating', 'how rating', 'fide rating', 'rating mean'],
      a: () => `📈 **Chess Rating (ELO)**\n\nELO is a number that estimates a player's strength. Win against stronger players → gain more points; lose to weaker players → lose more.\n\n**Rough guide:**\n• **800–1200** — Beginner / improving\n• **1200–1600** — Intermediate club player\n• **1600–2000** — Strong club player\n• **2000–2200** — Expert\n• **2200+** — Candidate Master / Master\n• **2500+** — Grandmaster (GM)\n\n💡 At Chesskidoo we track each student's rating so progress is always visible.`
    },
    {
      id: 'sicilian',
      keys: ['sicilian'],
      a: () => `♟️ **Sicilian Defense** (1.e4 c5)\n\nThe most popular and aggressive reply to 1.e4. Black fights for the center asymmetrically instead of mirroring with 1...e5.\n\n**Why it's great:**\n• Creates imbalanced, double-edged positions\n• Excellent winning chances for Black\n\n**Main variations:** Najdorf, Dragon, Scheveningen, Sveshnikov, Classical.\n\n💡 Best for players who enjoy sharp, tactical games.`
    },
    {
      id: 'ruylopez',
      keys: ['ruy lopez', 'spanish opening', 'spanish game'],
      a: () => `♟️ **Ruy Lopez / Spanish Game** (1.e4 e5 2.Nf3 Nc6 3.Bb5)\n\nOne of the oldest and most respected openings. White pressures the knight defending e5 and prepares a strong, lasting initiative.\n\n**Key ideas:** quick castling, the c3–d4 pawn break, and long-term pressure.\n**Popular lines:** Closed, Berlin Defense, Marshall Attack, Exchange Variation.`
    },
    {
      id: 'italian',
      keys: ['italian game', 'giuoco piano', 'two knights'],
      a: () => `♟️ **Italian Game** (1.e4 e5 2.Nf3 Nc6 3.Bc4)\n\nA classic, beginner-friendly opening. The bishop targets f7 — Black's weakest square early on.\n\n**Great for learning:** rapid development, central control, and king safety. Leads to both calm (Giuoco Pianissimo) and sharp (Two Knights) games.`
    },
    {
      id: 'french',
      keys: ['french defense', 'french defence'],
      a: () => `♟️ **French Defense** (1.e4 e6)\n\nA solid, strategic defense. Black builds a firm pawn chain and counterattacks White's center, accepting a slightly cramped but resilient position.\n\n**Note:** the light-squared bishop can be passive — plan to activate it. Main lines: Advance, Tarrasch, Winawer, Classical.`
    },
    {
      id: 'carokann',
      keys: ['caro-kann', 'caro kann', 'carokann'],
      a: () => `♟️ **Caro-Kann Defense** (1.e4 c6)\n\nSolid and reliable. Like the French, Black challenges the center with ...d5, but keeps the light-squared bishop free. Favored by players who like sound structures and fewer weaknesses.`
    },
    {
      id: 'queensgambit',
      keys: ['queen\'s gambit', 'queens gambit', 'queen gambit'],
      a: () => `♟️ **Queen's Gambit** (1.d4 d5 2.c4)\n\nNot a true sacrifice — White offers the c-pawn to deflect Black's d-pawn and dominate the center. One of the most principled openings in chess.\n\n**Lines:** Queen's Gambit Declined (QGD), Accepted (QGA), and the Slav Defense.`
    },
    {
      id: 'kingsindian',
      keys: ['king\'s indian', 'kings indian', 'kid '],
      a: () => `♟️ **King's Indian Defense** (1.d4 Nf6 2.c4 g6)\n\nA hypermodern, fighting defense. Black lets White build a big center, then strikes back with ...e5 or ...c5 and a kingside pawn storm. Sharp and ambitious.`
    },
    {
      id: 'london',
      keys: ['london system', 'london opening'],
      a: () => `♟️ **London System** (1.d4 + 2.Bf4 / 3.Bf4)\n\nA flexible, easy-to-learn setup White can play against almost anything. Solid development (Bf4, e3, Bd3, Nf3, c3) with a reliable, low-theory structure. Great for busy improvers.`
    },
    {
      id: 'openings_general',
      keys: ['opening', 'openings', 'best opening', 'which opening', 'first move'],
      a: () => `♟️ **Chess Openings — the essentials**\n\nGood opening play follows 3 principles:\n1. **Control the center** (e4/d4 or e5/d5)\n2. **Develop knights & bishops** quickly\n3. **Castle early** for king safety\n\n**Beginner-friendly choices:**\n• White: Italian Game, London System\n• Black vs 1.e4: Caro-Kann, ...e5\n• Black vs 1.d4: Queen's Gambit Declined\n\n💡 Ask me about any specific opening (e.g. *"Sicilian"*, *"Ruy Lopez"*) for details.`
    },
    {
      id: 'tactics',
      keys: ['tactic', 'tactics', 'fork', 'pin', 'skewer', 'discovered', 'combination', 'sacrifice'],
      a: () => `⚔️ **Chess Tactics — the building blocks**\n\n• **Fork** — one piece attacks two targets at once (knights are great at this)\n• **Pin** — a piece can't move because a more valuable piece is behind it\n• **Skewer** — like a pin, but the valuable piece is in front and forced to move\n• **Discovered attack** — moving one piece unveils an attack from another\n• **Double attack** — creating two threats in one move\n• **Sacrifice** — giving up material for a bigger gain (mate or decisive advantage)\n\n💡 Solving 5–10 puzzles daily is the fastest way to improve.`
    },
    {
      id: 'castling',
      keys: ['castle', 'castling'],
      a: () => `🏰 **Castling**\n\nA special king move for safety. The king moves 2 squares toward a rook, and that rook jumps to the king's other side.\n\n**Conditions:**\n• King & rook haven't moved\n• No pieces between them\n• King isn't in check, and doesn't pass through / land on an attacked square\n\n**Kingside (O-O):** quick & common. **Queenside (O-O-O):** more aggressive.`
    },
    {
      id: 'enpassant',
      keys: ['en passant', 'enpassant', 'passant'],
      a: () => `♟️ **En Passant** ("in passing")\n\nIf an enemy pawn moves **two squares** forward and lands beside your pawn, you may capture it **as if it moved only one square** — but only on the very next move.\n\nIt's the only capture where the captured piece isn't on the destination square. A common source of confusion for beginners!`
    },
    {
      id: 'stalemate',
      keys: ['stalemate', 'draw', 'stale mate', 'tie game', 'repetition', '50 move', 'fifty move'],
      a: () => `🤝 **Draws in Chess**\n\nA game is drawn when:\n• **Stalemate** — the side to move has no legal move but is *not* in check\n• **Threefold repetition** — same position occurs 3 times\n• **50-move rule** — 50 moves with no capture or pawn move\n• **Insufficient material** — e.g. K vs K, K+B vs K\n• **Agreement** — both players agree to a draw\n\n💡 Stalemate is a key defensive resource when you're losing!`
    },
    {
      id: 'checkmate',
      keys: ['checkmate', 'check mate', 'how to win', 'mate', 'win the game'],
      a: () => `♚ **Checkmate** ends the game — the king is in check and has **no legal way** to escape.\n\n**Beginner mating patterns:**\n• **Back-rank mate** — rook/queen on the 8th rank vs a king trapped by its own pawns\n• **Two-rook (ladder) mate**\n• **King + Queen vs King** — push the king to the edge\n\n💡 Tip: never give check just for fun — make sure it improves your position.`
    },
    {
      id: 'pieces',
      keys: ['piece value', 'piece values', 'how pieces move', 'point value', 'worth', 'how does the knight', 'how does the bishop'],
      a: () => `♟️ **Piece Values & Movement**\n\n| Piece | Value | Moves |\n| :-- | :-- | :-- |\n| Pawn | 1 | Forward 1 (or 2 first move); captures diagonally |\n| Knight | 3 | L-shape; jumps over pieces |\n| Bishop | 3 | Diagonally any distance |\n| Rook | 5 | Straight lines |\n| Queen | 9 | Any direction, any distance |\n| King | ∞ | One square any direction |\n\n💡 Values are guidelines — position and activity often matter more than material.`
    },
    {
      id: 'endgame',
      keys: ['endgame', 'end game', 'opposition', 'king and pawn', 'promote', 'promotion'],
      a: () => `♔ **Endgames**\n\nThe phase with few pieces left, where precise technique wins games.\n\n**Must-know ideas:**\n• **Opposition** — kings facing each other with one square between; the player *not* to move controls key squares\n• **Promotion** — push a pawn to the last rank to make a new queen\n• **King activity** — in the endgame the king becomes a strong attacker\n• **Rule of the square** — quick way to see if a lone king can catch a passed pawn`
    },
    {
      id: 'players',
      keys: ['magnus', 'carlsen', 'kasparov', 'fischer', 'anand', 'best player', 'world champion', 'greatest player'],
      a: () => `👑 **Famous Chess Champions**\n\n• **Magnus Carlsen** (Norway) — dominant modern World Champion, peak rating 2882 (highest ever)\n• **Garry Kasparov** — legendary World Champion 1985–2000\n• **Bobby Fischer** — 1972 World Champion, famous for genius & precision\n• **Viswanathan Anand** (India) — 5-time World Champion, inspired India's chess boom\n\n💡 Studying their games is a great way to learn strategy.`
    },
    {
      id: 'timecontrol',
      keys: ['time control', 'blitz', 'bullet', 'rapid', 'classical', 'clock'],
      a: () => `⏱️ **Chess Time Controls**\n\n• **Bullet** — 1–2 min per side (super fast)\n• **Blitz** — 3–5 min\n• **Rapid** — 10–25 min\n• **Classical** — 60+ min (used in serious tournaments)\n\n💡 Beginners improve fastest with **rapid** — enough time to think and apply what you learn.`
    },
    {
      id: 'improve',
      keys: ['improve', 'get better', 'study plan', 'practice', 'how to learn', 'tips', 'advice', 'homework'],
      a: () => `🚀 **How to Improve at Chess**\n\n1. **Tactics daily** — 10–15 puzzles (pattern recognition is king)\n2. **Play & review** — analyze your own games, especially losses\n3. **Learn 1–2 openings** well rather than many shallowly\n4. **Endgame basics** — king & pawn, basic mates\n5. **Study master games** — see good plans in action\n\n💡 Consistency beats intensity — 20 focused minutes daily works wonders.`
    },
    {
      id: 'phases',
      keys: ['middlegame', 'middle game', 'phases of chess', 'parts of the game'],
      a: () => `♟️ **The 3 Phases of a Chess Game**\n\n1. **Opening** — develop pieces, control the center, castle\n2. **Middlegame** — create plans, attack, use tactics, improve piece activity\n3. **Endgame** — convert advantages with precise technique\n\n💡 Each phase needs different thinking — that's what makes chess so deep.`
    },
    {
      id: 'notation',
      keys: ['notation', 'how to read moves', 'pgn', 'algebraic', 'record moves'],
      a: () => `📝 **Chess Notation (Algebraic)**\n\nFiles a–h (columns), ranks 1–8 (rows). Each piece has a letter: **K**ing, **Q**ueen, **R**ook, **B**ishop, **N**knight (pawns have none).\n\n**Examples:** \`Nf3\` (knight to f3), \`exd5\` (pawn on e captures d5), \`O-O\` (castle kingside), \`Qxh7#\` (queen captures h7, checkmate).`
    }
  ];

  function roleScope() {
    const role = window.role || 'guest';
    if (role === 'parent') return 'your child\'s progress, attendance, schedule, billing, and learning tips.';
    if (role === 'admin' || role === 'master') return 'students, coaches, finances, attendance, schedules and academy analytics.';
    return 'the academy, programs, and how to enroll.';
  }

  // Normalize for matching
  function norm(s) { return (' ' + String(s || '').toLowerCase() + ' ').replace(/[^a-z0-9'\- ]/g, ' '); }

  /**
   * Returns a markdown answer string if the query matches general chess /
   * conversational knowledge, otherwise null (so the caller can defer to the
   * data-driven server answer).
   */
  window.tomLocalAnswer = function (query) {
    const q = norm(query);
    let best = null, bestScore = 0;
    for (const entry of KB) {
      let score = 0;
      for (const k of entry.keys) {
        if (q.includes(' ' + k.trim() + ' ') || q.includes(k.trim())) {
          score += k.length; // longer keyword = more specific match
        }
      }
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    if (best && bestScore > 0) {
      return typeof best.a === 'function' ? best.a() : best.a;
    }
    // Generic chess mention with no specific topic → helpful nudge.
    if (/\bchess\b|\bplay\b|\bgame\b|\bboard\b/.test(q)) {
      return `♟️ I'd love to help with that! I can explain **openings** (Sicilian, Ruy Lopez, Italian…), **tactics** (forks, pins, skewers), **rules** (castling, en passant, stalemate), **endgames**, **study tips**, and more.\n\nTry asking something specific like *"What is the best opening for beginners?"* or *"How do I improve at chess?"*`;
    }
    return null;
  };

  /**
   * Decide the final text to show given the user query and the server's reply.
   * - If the server returned a real answer (not its generic template), use it.
   * - Otherwise prefer a local knowledge answer if we have one.
   * - Otherwise return the server text (or a friendly default).
   */
  window.tomResolveAnswer = function (query, serverText) {
    if (serverText && !window.tomServerGaveDefault(serverText)) {
      return serverText;
    }
    const local = window.tomLocalAnswer(query);
    if (local) return local;
    return serverText || `🤖 I'm here to help! Ask me about chess, or about ${roleScope()}`;
  };
})();
