/* Roped Together
 * A pixel-art, two-player, one-Chromebook, hot-seat game.
 * Made from a plan by Vinny, grade 7.
 *
 * Plain JavaScript, no build step, no dependencies, written to run
 * on Chrome 96 as well as Chrome 103 (no optional chaining tricks
 * that need newer engines, no structuredClone, no class fields).
 *
 * Vinny's four save actions live on the RT object below:
 *   RT.look()      -> whose turn is it right now
 *   RT.add(move)   -> record a move (and save our progress)
 *   RT.change(...) -> set a character's color
 *   RT.takeAway()  -> erase the saved game so we can start over
 * Everything is saved only on this computer, with localStorage.
 * There is no server, no accounts, and no second computer.
 */

(function () {
  'use strict';

  /* ======================= constants ======================= */

  var SAVE_KEY = 'ropedTogether_save_v1';
  var ACHIEVEMENT_KEY = 'ropedTogether_achievements_v1';
  var CUSTOM_KEY = 'ropedTogether_customLevel_v1';

  var COLORS = [
    { id: 'pink', hex: '#ff5d9e', name: 'Pink' },
    { id: 'blue', hex: '#4da8ff', name: 'Blue' },
    { id: 'green', hex: '#56e07a', name: 'Green' },
    { id: 'orange', hex: '#ffa445', name: 'Orange' },
    { id: 'purple', hex: '#b67bff', name: 'Purple' },
    { id: 'yellow', hex: '#ffe24d', name: 'Yellow' }
  ];

  var ZOOMS = [70, 80, 90, 100, 115, 130];

  var STONE_MS = 1000; // "about a second"

  function tile(h) { return { type: 'block', h: h }; }
  function gapTile() { return { type: 'gap' }; }

  // Four built-in levels. Each is solvable with only Left, Right and Up,
  // one legal step at a time, while staying inside the rope length.
  var LEVELS = [
    {
      name: 'Level 1',
      rope: 5,
      stepMs: 260,
      terrain: [tile(0), tile(0), tile(0), tile(0), tile(0), tile(0), tile(0), tile(0), tile(0), tile(0)],
      startA: 0,
      startB: 1,
      flag: 9
    },
    {
      name: 'Level 2',
      rope: 4,
      stepMs: 220,
      terrain: [tile(0), tile(0), tile(0), tile(0), tile(0), tile(1), tile(1), tile(0), tile(0), tile(0), tile(0), tile(0)],
      startA: 0,
      startB: 2,
      flag: 11
    },
    {
      name: 'Level 3',
      rope: 4,
      stepMs: 190,
      terrain: [tile(0), tile(0), tile(0), tile(1), tile(1), tile(0), tile(0), gapTile(), tile(0), tile(0), tile(1), tile(0), tile(0), tile(0)],
      startA: 0,
      startB: 1,
      flag: 13
    },
    {
      name: 'Hardest Mode',
      rope: 3,
      stepMs: 140,
      terrain: [tile(0), tile(0), tile(1), tile(1), tile(0), gapTile(), tile(0), tile(1), tile(2), tile(1), tile(0), gapTile(), tile(0), tile(0), tile(1), tile(0), tile(0), tile(0)],
      startA: 0,
      startB: 1,
      flag: 17
    }
  ];

  /* ======================= state ======================= */

  function freshState() {
    return {
      screen: 'join',
      colorA: null,
      colorB: null,
      levelIndex: 0,
      level: null,
      posA: 0,
      posB: 0,
      facingA: 1,
      facingB: 1,
      turn: 'A',
      moveLog: [],
      stoneUntilA: 0,
      stoneUntilB: 0,
      won: false
    };
  }

  var state = freshState();
  var achievements = { unlockedMaker: false };
  var customLevel = null;
  var anims = []; // in-flight step animations for the canvas renderer

  /* ======================= Vinny's four actions ======================= */
  /* RT = "Roped Together" storage, built around Vinny's plan. */

  var RT = {
    // Vinny's action 1: LOOK. Tells us whose turn it is right now.
    look: function () {
      return state.turn;
    },

    // Vinny's action 2: ADD. Records one move and saves our progress,
    // so the game can pick back up where it left off on this computer.
    add: function (moveRecord) {
      state.moveLog.push(moveRecord);
      if (state.moveLog.length > 300) {
        state.moveLog.shift();
      }
      saveProgress();
    },

    // Vinny's action 3: CHANGE. Sets a character's color.
    change: function (playerKey, colorId) {
      if (playerKey === 'A') {
        state.colorA = colorId;
      } else {
        state.colorB = colorId;
      }
      saveProgress();
    },

    // Vinny's action 4: TAKE AWAY. Erases the saved game so the two
    // players can start over. (Earned things, like unlocking the level
    // maker and the level you built, are kept - that is not "the game".)
    takeAway: function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      state = freshState();
    }
  };

  function saveProgress() {
    try {
      var blob = {
        colorA: state.colorA,
        colorB: state.colorB,
        levelIndex: state.levelIndex,
        posA: state.posA,
        posB: state.posB,
        facingA: state.facingA,
        facingB: state.facingB,
        turn: state.turn,
        moveCount: state.moveLog.length
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(blob));
    } catch (e) { /* storage unavailable: keep playing in memory only */ }
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveAchievements() {
    try {
      localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(achievements));
    } catch (e) { /* ignore */ }
  }

  function loadAchievements() {
    try {
      var raw = localStorage.getItem(ACHIEVEMENT_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.unlockedMaker) achievements.unlockedMaker = true;
      }
    } catch (e) { /* ignore */ }
  }

  function saveCustomLevel(level) {
    customLevel = level;
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(level));
    } catch (e) { /* ignore */ }
  }

  function loadCustomLevel() {
    try {
      var raw = localStorage.getItem(CUSTOM_KEY);
      if (raw) customLevel = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }

  /* ======================= audio (starts only after a click) ======================= */

  var audioCtx = null;
  function ensureAudio() {
    if (audioCtx) return audioCtx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  }

  function beep(freq, durationMs, type, gainPeak) {
    var ctx = ensureAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* ignore */ } }
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    var now = ctx.currentTime;
    var peak = gainPeak || 0.12;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  function sfxStep() { beep(420, 90, 'square', 0.08); }
  function sfxStone() { beep(140, 260, 'sawtooth', 0.12); }
  function sfxIllegal() { beep(200, 120, 'square', 0.06); }
  function sfxWin() {
    beep(523, 140, 'triangle', 0.14);
    window.setTimeout(function () { beep(659, 140, 'triangle', 0.14); }, 130);
    window.setTimeout(function () { beep(784, 220, 'triangle', 0.16); }, 260);
  }

  var audioUnlocked = false;
  function unlockAudioOnFirstClick() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    ensureAudio();
  }
  document.addEventListener('pointerdown', unlockAudioOnFirstClick);
  document.addEventListener('keydown', unlockAudioOnFirstClick);

  /* ======================= DOM refs ======================= */

  var el = {};
  function cacheDom() {
    el.app = document.getElementById('app');
    el.zoomBar = document.getElementById('zoom-bar');
    el.screenJoin = document.getElementById('screen-join');
    el.screenPlay = document.getElementById('screen-play');
    el.screenMaker = document.getElementById('screen-maker');

    el.joinFlagCanvas = document.getElementById('join-flag-canvas');
    el.colorsA = document.getElementById('colors-a');
    el.colorsB = document.getElementById('colors-b');
    el.nameA = document.getElementById('picker-name-a');
    el.nameB = document.getElementById('picker-name-b');
    el.btnStart = document.getElementById('btn-start');
    el.resumeNote = document.getElementById('resume-note');
    el.btnContinue = document.getElementById('btn-continue');
    el.makerUnlockLink = document.getElementById('maker-unlock-link');

    el.levelName = document.getElementById('level-name');
    el.turnDot = document.getElementById('turn-dot');
    el.turnLabel = document.getElementById('turn-label');
    el.coach = document.getElementById('coach');
    el.ropeNote = document.getElementById('rope-note');
    el.btnRestartPlay = document.getElementById('btn-restart-play');
    el.canvas = document.getElementById('game-canvas');
    el.canvasWrap = document.getElementById('canvas-wrap');
    el.toast = document.getElementById('toast');
    el.winOverlay = document.getElementById('win-overlay');
    el.winTitle = document.getElementById('win-title');
    el.winSub = document.getElementById('win-sub');
    el.winActions = document.getElementById('win-actions');
    el.clusterA = document.getElementById('cluster-a');
    el.clusterB = document.getElementById('cluster-b');

    el.btnRestartMaker = document.getElementById('btn-restart-maker');
    el.makerGridWrap = document.getElementById('maker-grid-wrap');
    el.makerRope = document.getElementById('maker-rope');
    el.makerRopeVal = document.getElementById('maker-rope-val');
    el.makerStatus = document.getElementById('maker-status');
    el.btnMakerSave = document.getElementById('btn-maker-save');
    el.btnMakerPlus = document.getElementById('btn-maker-plus');
    el.btnMakerMinus = document.getElementById('btn-maker-minus');
    el.btnMakerBack = document.getElementById('btn-maker-back');
  }

  /* ======================= zoom ======================= */

  function setZoom(pct) {
    document.documentElement.style.setProperty('--z', (pct / 100).toString());
    var btns = el.zoomBar.querySelectorAll('.zoom-btn');
    for (var i = 0; i < btns.length; i++) {
      if (parseInt(btns[i].getAttribute('data-zoom'), 10) === pct) {
        btns[i].className = 'zoom-btn active';
      } else {
        btns[i].className = 'zoom-btn';
      }
    }
    resizeCanvas();
  }

  function buildZoomBar() {
    el.zoomBar.innerHTML = '';
    for (var i = 0; i < ZOOMS.length; i++) {
      var pct = ZOOMS[i];
      var b = document.createElement('button');
      b.className = 'zoom-btn' + (pct === 100 ? ' active' : '');
      b.setAttribute('data-zoom', String(pct));
      b.textContent = pct + '%';
      b.addEventListener('click', function () {
        setZoom(parseInt(this.getAttribute('data-zoom'), 10));
      });
      el.zoomBar.appendChild(b);
    }
  }

  window.addEventListener('resize', function () { resizeCanvas(); });

  /* ======================= screen switching ======================= */

  function showScreen(name) {
    state.screen = name;
    el.screenJoin.className = 'screen' + (name === 'join' ? '' : ' hidden');
    el.screenPlay.className = 'screen' + (name === 'play' ? '' : ' hidden');
    el.screenMaker.className = 'screen' + (name === 'maker' ? '' : ' hidden');
    if (name === 'play') {
      window.requestAnimationFrame(function () { resizeCanvas(); renderGame(); });
    }
    if (name === 'maker') {
      renderMakerGrid();
    }
    if (name === 'join') {
      refreshJoinScreen();
    }
  }

  /* ======================= JOIN SCREEN ======================= */

  function buildColorPickers() {
    [['A', el.colorsA], ['B', el.colorsB]].forEach(function (pair) {
      var key = pair[0];
      var container = pair[1];
      container.innerHTML = '';
      COLORS.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'swatch';
        b.style.background = c.hex;
        b.setAttribute('data-color', c.id);
        b.title = c.name;
        b.addEventListener('click', function () {
          var colorId = this.getAttribute('data-color');
          RT.change(key, colorId);
          refreshJoinScreen();
        });
        container.appendChild(b);
      });
    });
  }

  function refreshJoinScreen() {
    paintSwatches(el.colorsA, state.colorA);
    paintSwatches(el.colorsB, state.colorB);
    el.nameA.textContent = state.colorA ? colorName(state.colorA) : 'Pick a color';
    el.nameB.textContent = state.colorB ? colorName(state.colorB) : 'Pick a color';

    var bothPicked = state.colorA && state.colorB && state.colorA !== state.colorB;
    el.btnStart.disabled = !bothPicked;

    var saved = loadProgress();
    var hasProgress = !!(saved && (saved.levelIndex > 0 || saved.posA > 0 || saved.posB > 0 || (saved.turn && saved.moveCount > 0)));
    if (hasProgress) {
      el.resumeNote.textContent = 'You have a game in progress. Continue it, or press Start to begin a new one.';
      el.btnContinue.className = 'ghost-btn';
    } else {
      el.resumeNote.textContent = '';
      el.btnContinue.className = 'ghost-btn hidden';
    }

    el.makerUnlockLink.className = achievements.unlockedMaker ? 'ghost-btn' : 'ghost-btn hidden';

    if (!state.colorA && !state.colorB && saved) {
      if (saved.colorA) { state.colorA = saved.colorA; paintSwatches(el.colorsA, state.colorA); el.nameA.textContent = colorName(state.colorA); }
      if (saved.colorB) { state.colorB = saved.colorB; paintSwatches(el.colorsB, state.colorB); el.nameB.textContent = colorName(state.colorB); }
      el.btnStart.disabled = !(state.colorA && state.colorB && state.colorA !== state.colorB);
    }
  }

  function paintSwatches(container, selectedId) {
    var btns = container.querySelectorAll('.swatch');
    for (var i = 0; i < btns.length; i++) {
      var isSel = btns[i].getAttribute('data-color') === selectedId;
      btns[i].className = 'swatch' + (isSel ? ' selected' : '');
    }
  }

  function colorName(id) {
    for (var i = 0; i < COLORS.length; i++) {
      if (COLORS[i].id === id) return COLORS[i].name;
    }
    return '';
  }

  function colorHex(id) {
    for (var i = 0; i < COLORS.length; i++) {
      if (COLORS[i].id === id) return COLORS[i].hex;
    }
    return '#999999';
  }

  function startNewGame() {
    var colorA = state.colorA;
    var colorB = state.colorB;
    RT.takeAway();
    state.colorA = colorA;
    state.colorB = colorB;
    saveProgress();
    loadLevel(0);
    showScreen('play');
  }

  function continueGame() {
    var saved = loadProgress();
    if (!saved) { startNewGame(); return; }
    var idx = saved.levelIndex;
    if (idx === 'custom') {
      loadCustomLevelIntoPlay();
    } else {
      loadLevel(idx || 0);
    }
    if (typeof saved.posA === 'number') state.posA = saved.posA;
    if (typeof saved.posB === 'number') state.posB = saved.posB;
    if (typeof saved.facingA === 'number') state.facingA = saved.facingA;
    if (typeof saved.facingB === 'number') state.facingB = saved.facingB;
    if (saved.turn) state.turn = saved.turn;
    if (saved.colorA) state.colorA = saved.colorA;
    if (saved.colorB) state.colorB = saved.colorB;
    showScreen('play');
  }

  /* ======================= LEVEL LOADING ======================= */

  function loadLevel(idx) {
    state.levelIndex = idx;
    state.level = LEVELS[idx];
    state.posA = state.level.startA;
    state.posB = state.level.startB;
    state.facingA = (state.level.flag >= state.posA) ? 1 : -1;
    state.facingB = (state.level.flag >= state.posB) ? 1 : -1;
    state.turn = 'A';
    state.won = false;
    anims = [];
    updateHeaderForLevel();
    saveProgress();
  }

  function loadCustomLevelIntoPlay() {
    if (!customLevel) loadCustomLevel();
    if (!customLevel) { loadLevel(0); return; }
    state.levelIndex = 'custom';
    state.level = customLevel;
    state.posA = customLevel.startA;
    state.posB = customLevel.startB;
    state.facingA = (customLevel.flag >= state.posA) ? 1 : -1;
    state.facingB = (customLevel.flag >= state.posB) ? 1 : -1;
    state.turn = 'A';
    state.won = false;
    anims = [];
    updateHeaderForLevel();
    saveProgress();
  }

  function updateHeaderForLevel() {
    el.levelName.textContent = state.level.name + (state.levelIndex === 'custom' ? ' (your level)' : '');
    el.ropeNote.textContent = 'Rope: ' + state.level.rope + ' tiles max';
    paintClusterColors();
    hideWinOverlay();
    updateTurnUI();
  }

  function paintClusterColors() {
    el.clusterA.style.borderColor = 'transparent';
    var labelA = document.getElementById('cluster-label-a');
    var labelB = document.getElementById('cluster-label-b');
    var hexA = colorHex(state.colorA || 'pink');
    var hexB = colorHex(state.colorB || 'blue');
    labelA.style.color = hexA;
    labelB.style.color = hexB;
    var btnsA = el.clusterA.querySelectorAll('.step-btn');
    for (var i = 0; i < btnsA.length; i++) btnsA[i].style.background = hexA;
    var btnsB = el.clusterB.querySelectorAll('.step-btn');
    for (var j = 0; j < btnsB.length; j++) btnsB[j].style.background = hexB;
  }

  /* ======================= GAME RULES ======================= */

  function currentHeight(level, x) {
    var t = level.terrain[x];
    if (!t || t.type !== 'block') return null;
    return t.h;
  }

  // Try one legal step for a player. action is 'left' | 'right' | 'up'.
  // Returns { ok:true, x:newX, dx:tilesMoved } or { ok:false }.
  function tryStep(level, playerKey, action) {
    var isA = playerKey === 'A';
    var x = isA ? state.posA : state.posB;
    var facing = isA ? state.facingA : state.facingB;
    var otherX = isA ? state.posB : state.posA;
    var h = currentHeight(level, x);
    if (h === null) return { ok: false };

    if (action === 'left' || action === 'right') {
      var dir = action === 'left' ? -1 : 1;
      var nx = x + dir;
      var th = currentHeight(level, nx);
      if (th === null) return { ok: false, reason: 'edge' };
      if (th > h) return { ok: false, reason: 'high' };
      if (Math.abs(nx - otherX) > level.rope) return { ok: false, reason: 'rope' };
      return { ok: true, x: nx, facing: dir, tiles: 1 };
    }

    if (action === 'up') {
      var f = facing || 1;
      var oneAhead = level.terrain[x + f];
      if (oneAhead && oneAhead.type === 'block' && oneAhead.h === h + 1) {
        var nx1 = x + f;
        if (Math.abs(nx1 - otherX) > level.rope) return { ok: false, reason: 'rope' };
        return { ok: true, x: nx1, facing: f, tiles: 1 };
      }
      var twoAhead = level.terrain[x + 2 * f];
      if (oneAhead && oneAhead.type === 'gap' && twoAhead && twoAhead.type === 'block' && twoAhead.h <= h) {
        var nx2 = x + 2 * f;
        if (Math.abs(nx2 - otherX) > level.rope) return { ok: false, reason: 'rope' };
        return { ok: true, x: nx2, facing: f, tiles: 2 };
      }
      return { ok: false, reason: 'up' };
    }

    return { ok: false, reason: 'edge' };
  }

  function moveMessage(reason) {
    if (reason === 'rope') return 'The rope is too short. Your partner needs to step closer.';
    if (reason === 'high') return 'That block is too high to walk onto. Press Up to climb.';
    if (reason === 'up') return 'Up climbs a taller block or hops a gap. Walk with Left or Right.';
    return 'There is no ground that way.';
  }

  // What the player whose turn it is should press next.
  function suggestedMove(playerKey) {
    if (!state.level) return { action: null, line: 'Pick a button to step.' };
    var x = playerKey === 'A' ? state.posA : state.posB;
    var name = colorName((playerKey === 'A' ? state.colorA : state.colorB) || (playerKey === 'A' ? 'pink' : 'blue'));
    if (x === state.level.flag) {
      return { action: null, line: name + ' is on the flag. Wait for your partner.' };
    }
    var dir = state.level.flag > x ? 'right' : 'left';
    var word = dir === 'right' ? 'RIGHT' : 'LEFT';
    var walk = tryStep(state.level, playerKey, dir);
    if (walk.ok) return { action: dir, line: name + ', press ' + word + ' to step toward the flag.' };
    var up = tryStep(state.level, playerKey, 'up');
    if (up.ok) {
      var facing = playerKey === 'A' ? state.facingA : state.facingB;
      var ahead = state.level.terrain[x + (facing || 1)];
      if (ahead && ahead.type === 'gap') return { action: 'up', line: name + ', press UP to hop the gap.' };
      return { action: 'up', line: name + ', press UP to climb.' };
    }
    if (walk.reason === 'rope' || up.reason === 'rope') {
      return { action: null, line: 'The rope is tight. ' + name + ' should wait. The other player steps closer.' };
    }
    return { action: dir, line: name + ', press ' + word + '.' };
  }

  function pressButton(playerKey, action) {
    if (state.won) return;
    if (!state.level) return;
    if (state.turn !== playerKey) {
      triggerStone(playerKey);
      return;
    }
    var res = tryStep(state.level, playerKey, action);
    if (!res.ok) {
      sfxIllegal();
      shakeCharacter(playerKey);
      showToast(moveMessage(res.reason));
      kickRender();
      return;
    }
    var fromX = playerKey === 'A' ? state.posA : state.posB;
    if (playerKey === 'A') { state.posA = res.x; state.facingA = res.facing; }
    else { state.posB = res.x; state.facingB = res.facing; }

    anims.push({
      player: playerKey,
      fromX: fromX,
      toX: res.x,
      start: performance.now(),
      duration: state.level.stepMs
    });

    sfxStep();
    RT.add({ player: playerKey, action: action, x: res.x, t: Date.now() });

    state.turn = state.turn === 'A' ? 'B' : 'A';
    updateTurnUI();
    saveProgress();
    kickRender();

    if (state.posA === state.level.flag && state.posB === state.level.flag) {
      state.won = true;
      window.setTimeout(handleWin, Math.max(state.level.stepMs, 180));
    }
  }

  function triggerStone(playerKey) {
    var now = performance.now();
    if (playerKey === 'A') state.stoneUntilA = now + STONE_MS;
    else state.stoneUntilB = now + STONE_MS;
    sfxStone();
    showToast('Almost your turn, just wait!');
    pulseTurnArrow();
    updateTurnUI();
    kickRender();
    window.setTimeout(function () {
      updateTurnUI();
    }, STONE_MS);
  }

  function shakeCharacter(playerKey) {
    anims.push({ shake: true, player: playerKey, start: performance.now(), duration: 220 });
  }

  var toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.className = 'toast show';
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.toast.className = 'toast';
    }, STONE_MS);
  }

  function pulseTurnArrow() {
    el.turnDot.className = 'pulse';
    window.setTimeout(function () { el.turnDot.className = ''; }, 1000);
  }

  function clusterClass(playerKey) {
    var cls = 'cluster';
    cls += state.turn === playerKey ? ' active' : ' waiting';
    var now = performance.now();
    var until = playerKey === 'A' ? state.stoneUntilA : state.stoneUntilB;
    if (now < until) cls += ' stone';
    return cls;
  }

  function clearButtonHints() {
    var hinted = document.querySelectorAll('.step-btn.hint');
    for (var i = 0; i < hinted.length; i++) {
      hinted[i].className = hinted[i].className.replace(' hint', '');
    }
  }

  function updateTurnUI() {
    var isA = state.turn === 'A';
    var activeKey = isA ? 'A' : 'B';
    var hex = colorHex((isA ? state.colorA : state.colorB) || (isA ? 'pink' : 'blue'));
    var name = colorName((isA ? state.colorA : state.colorB) || (isA ? 'pink' : 'blue'));
    el.turnDot.style.background = hex;
    el.turnLabel.textContent = name + "'s turn";
    var hint = suggestedMove(activeKey);
    el.coach.textContent = hint.line;
    el.clusterA.className = clusterClass('A');
    el.clusterB.className = clusterClass('B');
    var labelA = document.getElementById('cluster-label-a');
    var labelB = document.getElementById('cluster-label-b');
    labelA.textContent = colorName(state.colorA || 'pink') + (isA ? ' · YOUR TURN' : ' · wait');
    labelB.textContent = colorName(state.colorB || 'blue') + (!isA ? ' · YOUR TURN' : ' · wait');
    clearButtonHints();
    if (hint.action) {
      var cluster = isA ? el.clusterA : el.clusterB;
      var btn = cluster.querySelector('.step-btn.' + hint.action);
      if (btn) btn.className = btn.className + ' hint';
    }
  }

  function hideWinOverlay() {
    el.winOverlay.className = 'hidden';
  }

  function handleWin() {
    sfxWin();
    var isHardest = state.levelIndex === LEVELS.length - 1;
    var isCustom = state.levelIndex === 'custom';
    el.winActions.innerHTML = '';

    if (isCustom) {
      el.winTitle.textContent = 'You both made it!';
      el.winSub.textContent = 'Great job sharing the rope on your own level.';
      addWinButton('Play it again', function () { loadCustomLevelIntoPlay(); showScreen('play'); });
      addWinButton('Back to the Level Maker', function () { showScreen('maker'); renderMakerGrid(); });
    } else if (isHardest) {
      achievements.unlockedMaker = true;
      saveAchievements();
      el.winTitle.textContent = 'You beat Hardest Mode!';
      el.winSub.textContent = 'Great teamwork! You just unlocked the Level Maker, made from Vinny\u2019s plan, grade 7.';
      addWinButton('Open the Level Maker', function () { showScreen('maker'); renderMakerGrid(); });
      addWinButton('Play Level 1 again', function () { loadLevel(0); showScreen('play'); });
    } else {
      el.winTitle.textContent = 'You both reached the flag!';
      el.winSub.textContent = 'Great job sharing the rope. Here comes a harder level.';
      addWinButton('Next level', function () { loadLevel(state.levelIndex + 1); showScreen('play'); });
    }
    el.winOverlay.className = '';
  }

  function addWinButton(label, onClick) {
    var b = document.createElement('button');
    b.className = 'big-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    el.winActions.appendChild(b);
  }

  function restartGame() {
    RT.takeAway();
    showScreen('join');
  }

  /* ======================= CANVAS RENDERING (play) ======================= */

  var ctx = null;
  var renderScheduled = false;

  function kickRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    window.requestAnimationFrame(function () {
      renderScheduled = false;
      renderGame();
    });
  }

  function resizeCanvas() {
    if (!el.canvas || state.screen !== 'play') return;
    var rect = el.canvasWrap.getBoundingClientRect();
    var w = Math.max(100, Math.round(rect.width));
    var h = Math.max(80, Math.round(rect.height));
    if (el.canvas.width !== w) el.canvas.width = w;
    if (el.canvas.height !== h) el.canvas.height = h;
    ctx = el.canvas.getContext('2d');
    renderGame();
  }

  function renderGame() {
    if (state.screen !== 'play') return;
    if (!ctx || !state.level) return;
    var level = state.level;
    var W = el.canvas.width, H = el.canvas.height;
    ctx.clearRect(0, 0, W, H);

    var n = level.terrain.length;
    var tileSize = Math.max(26, Math.min(58, Math.floor(W / (n + 1))));
    var groundTopMargin = 70;
    var baseline = H - 44;
    var levelH = Math.min(3, Math.max(1, Math.floor((baseline - groundTopMargin) / (tileSize * 0.8))));
    var stepH = Math.floor((baseline - groundTopMargin) / 3);
    var totalW = n * tileSize;
    var offsetX = Math.max(14, Math.floor((W - totalW) / 2));

    function xOf(i) { return offsetX + i * tileSize; }
    function yOf(h) { return baseline - h * stepH; }

    // sky dots (tiny stars for pixel-art feel)
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (var s = 0; s < 18; s++) {
      var sx = (s * 97 + 31) % W;
      var sy = (s * 53 + 11) % Math.max(1, (baseline - 110));
      ctx.fillRect(sx, sy + 8, 2, 2);
    }

    // terrain
    for (var i = 0; i < n; i++) {
      var t = level.terrain[i];
      var px = xOf(i);
      if (t.type === 'gap') {
        ctx.fillStyle = '#0c0919';
        ctx.fillRect(px, baseline - 2, tileSize, H - baseline + 2);
        ctx.strokeStyle = '#3a2d63';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 2, baseline - 2, tileSize - 4, 10);
        continue;
      }
      var topY = yOf(t.h);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(px, topY, tileSize, 8);
      ctx.fillStyle = '#6a4a2b';
      ctx.fillRect(px, topY + 8, tileSize, H - topY - 8);
      ctx.fillStyle = '#5a3d21';
      for (var bx = px; bx < px + tileSize; bx += 10) {
        ctx.fillRect(bx, topY + 16, 2, Math.max(2, H - topY - 24));
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, topY + 0.5, tileSize - 1, 7);
    }

    // flag
    var flagX = xOf(level.flag) + tileSize / 2;
    var flagBase = yOf(currentHeight(level, level.flag) || 0);
    drawFlag(flagX, flagBase, tileSize);

    // characters (with simple animation interpolation)
    var posAx = state.posA, posBx = state.posB;
    var shakeA = 0, shakeB = 0;
    var hopA = 0, hopB = 0;
    var now = performance.now();
    var stoneA = now < state.stoneUntilA;
    var stoneB = now < state.stoneUntilB;
    anims = anims.filter(function (a) { return now - a.start < a.duration; });
    anims.forEach(function (a) {
      var p = Math.min(1, (now - a.start) / a.duration);
      var ease = 1 - Math.pow(1 - p, 2);
      if (a.shake) {
        var wobble = Math.sin(p * Math.PI * 6) * (1 - p) * 6;
        if (a.player === 'A') shakeA = wobble; else shakeB = wobble;
      } else if (a.player === 'A') {
        posAx = a.fromX + (a.toX - a.fromX) * ease;
        hopA = Math.sin(p * Math.PI) * 26;
      } else {
        posBx = a.fromX + (a.toX - a.fromX) * ease;
        hopB = Math.sin(p * Math.PI) * 26;
      }
    });

    if (!stoneA && state.turn === 'A' && hopA === 0) hopA = Math.sin(now / 160) * 5;
    if (!stoneB && state.turn === 'B' && hopB === 0) hopB = Math.sin(now / 160) * 5;

    var hA = heightAtInterpolated(level, posAx);
    var hB = heightAtInterpolated(level, posBx);
    var ax = xOf(posAx) + tileSize / 2 + shakeA;
    var ay = yOf(hA) - hopA;
    var bx = xOf(posBx) + tileSize / 2 + shakeB;
    var by = yOf(hB) - hopB;

    drawRope(ax, ay, bx, by, Math.abs(Math.round(posAx) - Math.round(posBx)), level.rope);

    var nameA = colorName(state.colorA || 'pink');
    var nameB = colorName(state.colorB || 'blue');
    drawCharacter(ax, ay, tileSize, colorHex(state.colorA || 'pink'), stoneA, state.facingA, state.turn === 'A', nameA);
    drawCharacter(bx, by, tileSize, colorHex(state.colorB || 'blue'), stoneB, state.facingB, state.turn === 'B', nameB);

    kickRender();
  }

  function heightAtInterpolated(level, xFloat) {
    var lo = Math.floor(xFloat);
    var hi = Math.ceil(xFloat);
    var hLo = currentHeight(level, lo);
    var hHi = currentHeight(level, hi);
    if (hLo === null) hLo = hHi === null ? 0 : hHi;
    if (hHi === null) hHi = hLo;
    var frac = xFloat - lo;
    return hLo + (hHi - hLo) * frac;
  }

  function drawFlag(x, baseY, tileSize) {
    var poleH = tileSize * 2.2;
    ctx.fillStyle = '#d8c9a3';
    ctx.fillRect(x - 2, baseY - poleH, 4, poleH);
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.moveTo(x + 2, baseY - poleH + 4);
    ctx.lineTo(x + 2 + tileSize * 0.6, baseY - poleH + 14);
    ctx.lineTo(x + 2, baseY - poleH + 24);
    ctx.closePath();
    ctx.fill();
  }

  function drawRope(ax, ay, bx, by, dist, maxRope) {
    var ratio = maxRope > 0 ? dist / maxRope : 0;
    var color = '#caa866';
    if (ratio > 0.85) color = '#ff5d5d';
    else if (ratio > 0.6) color = '#ffcf4d';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    var midY = Math.max(ay, by) + 10;
    ctx.moveTo(ax, ay - 6);
    ctx.quadraticCurveTo((ax + bx) / 2, midY, bx, by - 6);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawCharacter(x, y, tileSize, hex, isStone, facing, isActive, name) {
    var w = Math.round(tileSize * 0.62);
    var h = Math.round(tileSize * 0.9);
    var top = y - h;
    ctx.save();
    if (isActive) {
      ctx.shadowColor = hex;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = isStone ? '#8a8a8a' : hex;
    // body
    ctx.fillRect(x - w / 2, top + h * 0.32, w, h * 0.68);
    // head
    var headSize = w * 0.9;
    ctx.fillRect(x - headSize / 2, top, headSize, h * 0.36);
    ctx.restore();

    // face (front-facing simple eyes) - skip if stone (cracked look instead)
    if (!isStone) {
      ctx.fillStyle = '#1a1330';
      var eyeOffset = facing >= 0 ? headSize * 0.12 : -headSize * 0.12;
      ctx.fillRect(x - headSize * 0.22 + eyeOffset, top + h * 0.12, 3, 4);
      ctx.fillRect(x + headSize * 0.06 + eyeOffset, top + h * 0.12, 3, 4);
    } else {
      ctx.strokeStyle = '#4a4a4a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, top + h * 0.2);
      ctx.lineTo(x + w * 0.1, top + h * 0.6);
      ctx.moveTo(x + w * 0.25, top + h * 0.1);
      ctx.lineTo(x, top + h * 0.5);
      ctx.stroke();
    }

    ctx.font = 'bold 14px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (isActive && !isStone) {
      ctx.fillStyle = '#ffcf4d';
      ctx.fillText('GO', x, top - 16);
      ctx.beginPath();
      ctx.moveTo(x - 6, top - 12);
      ctx.lineTo(x + 6, top - 12);
      ctx.lineTo(x, top - 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#fff6e0';
    ctx.fillText(name || '', x, isActive && !isStone ? top - 30 : top - 4);

    // feet shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - w / 2, y - 2, w, 3);
  }

  /* ======================= JOIN FLAG PIXEL ART ======================= */

  function drawJoinFlag() {
    var c = el.joinFlagCanvas;
    var cctx = c.getContext('2d');
    var N = 16;
    c.width = N; c.height = N;
    cctx.clearRect(0, 0, N, N);
    // palette
    var P = { '.': null, 'o': '#d8c9a3', 'r': '#ff4d4d', 'd': '#c22c2c', 'g': '#3a9d4a' };
    var rows = [
      '................',
      '....rrrrr.......',
      '....rrrrrrr.....',
      '....rrrrrrrrr...',
      '....rrrrrrr.....',
      '....rrrrr.......',
      '....o...........',
      '....o...........',
      '....o...........',
      '....o...........',
      '....o...........',
      '....o...........',
      '....o...........',
      '...oooo.........',
      'gggggggggggggggg',
      'gggggggggggggggg'
    ];
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        var color = P[ch];
        if (color) {
          cctx.fillStyle = color;
          cctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  /* ======================= LEVEL MAKER ======================= */

  var maker = {
    length: 14,
    terrain: [],
    startA: 0,
    startB: 1,
    flag: 12,
    rope: 4,
    mode: 'block' // 'block' | 'startA' | 'startB' | 'flag'
  };

  function makerInit() {
    maker.terrain = [];
    for (var i = 0; i < maker.length; i++) maker.terrain.push(tile(0));
    maker.startA = 0;
    maker.startB = 1;
    maker.flag = maker.length - 1;
    maker.rope = 4;
    maker.mode = 'block';
    el.makerRope.value = String(maker.rope);
    el.makerRopeVal.textContent = String(maker.rope);
  }

  function setMakerLength(delta) {
    var newLen = Math.max(6, Math.min(22, maker.length + delta));
    if (newLen === maker.length) return;
    if (delta > 0) {
      while (maker.terrain.length < newLen) maker.terrain.push(tile(0));
    } else {
      maker.terrain = maker.terrain.slice(0, newLen);
      if (maker.startA >= newLen) maker.startA = 0;
      if (maker.startB >= newLen) maker.startB = Math.min(1, newLen - 1);
      if (maker.flag >= newLen) maker.flag = newLen - 1;
    }
    maker.length = newLen;
    renderMakerGrid();
  }

  function setMakerMode(mode) {
    maker.mode = mode;
    var ids = ['block', 'startA', 'startB', 'flag'];
    ids.forEach(function (m) {
      var b = document.getElementById('mode-' + m);
      b.className = 'mode-btn' + (m === mode ? ' active' : '');
    });
  }

  function makerCellClick(i) {
    if (maker.mode === 'block') {
      var t = maker.terrain[i];
      if (t.type === 'gap') { maker.terrain[i] = tile(0); }
      else if (t.h >= 2) { maker.terrain[i] = gapTile(); }
      else { maker.terrain[i] = tile(t.h + 1); }
    } else if (maker.mode === 'startA') {
      if (maker.terrain[i].type === 'block') maker.startA = i;
    } else if (maker.mode === 'startB') {
      if (maker.terrain[i].type === 'block') maker.startB = i;
    } else if (maker.mode === 'flag') {
      if (maker.terrain[i].type === 'block') maker.flag = i;
    }
    renderMakerGrid();
  }

  function renderMakerGrid() {
    el.makerGridWrap.innerHTML = '';
    for (var i = 0; i < maker.terrain.length; i++) {
      var t = maker.terrain[i];
      var cellH = t.type === 'gap' ? 0 : 36 + t.h * 26;
      var cell = document.createElement('button');
      cell.className = 'maker-cell' + (t.type === 'gap' ? ' gap' : '');
      cell.style.height = (t.type === 'gap' ? 20 : cellH) + 'px';
      cell.title = t.type === 'gap' ? 'gap' : ('height ' + t.h);
      (function (idx) {
        cell.addEventListener('click', function () { makerCellClick(idx); });
      })(i);

      if (maker.startA === i) addMark(cell, 'A', '#ff5d9e');
      if (maker.startB === i) addMark(cell, 'B', '#4da8ff');
      if (maker.flag === i) addMark(cell, 'F', '#ffcf4d');

      el.makerGridWrap.appendChild(cell);
    }
    var msgs = [];
    if (maker.terrain[maker.startA].type === 'gap') msgs.push('Player A\u2019s start is on a gap.');
    if (maker.terrain[maker.startB].type === 'gap') msgs.push('Player B\u2019s start is on a gap.');
    if (maker.terrain[maker.flag].type === 'gap') msgs.push('The flag is on a gap.');
    el.makerStatus.textContent = msgs.length ? msgs.join(' ') : 'Click a tile to raise it. Use the buttons to place A, B and the flag.';
  }

  function addMark(cell, letter, color) {
    var span = document.createElement('span');
    span.className = 'mark';
    span.textContent = letter;
    span.style.background = color;
    span.style.color = '#1a1330';
    // offset additional marks so they don't overlap
    var existing = cell.querySelectorAll('.mark').length;
    span.style.left = (50 + existing * 20) + '%';
    cell.appendChild(span);
  }

  function makerSaveAndPlay() {
    if (maker.terrain[maker.startA].type === 'gap' ||
        maker.terrain[maker.startB].type === 'gap' ||
        maker.terrain[maker.flag].type === 'gap') {
      el.makerStatus.textContent = 'Fix the gaps under A, B or the flag before saving.';
      return;
    }
    var level = {
      name: 'My Level',
      rope: maker.rope,
      stepMs: 220,
      terrain: maker.terrain.map(function (t) { return t.type === 'gap' ? gapTile() : tile(t.h); }),
      startA: maker.startA,
      startB: maker.startB,
      flag: maker.flag
    };
    saveCustomLevel(level);
    loadCustomLevelIntoPlay();
    showScreen('play');
  }

  /* ======================= INPUT WIRING ======================= */

  function wireInput() {
    el.btnStart.addEventListener('click', startNewGame);
    el.btnContinue.addEventListener('click', continueGame);
    el.makerUnlockLink.addEventListener('click', function () { showScreen('maker'); renderMakerGrid(); });

    el.btnRestartPlay.addEventListener('click', restartGame);
    el.btnRestartMaker.addEventListener('click', restartGame);

    bindCluster(el.clusterA, 'A');
    bindCluster(el.clusterB, 'B');

    document.addEventListener('keydown', function (ev) {
      if (state.screen !== 'play') return;
      var active = state.turn;
      if (ev.key === 'ArrowLeft') { pressButton(active, 'left'); ev.preventDefault(); }
      else if (ev.key === 'ArrowRight') { pressButton(active, 'right'); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { pressButton(active, 'up'); ev.preventDefault(); }
      // ArrowDown is intentionally not wired to anything.
    });

    document.getElementById('mode-block').addEventListener('click', function () { setMakerMode('block'); });
    document.getElementById('mode-startA').addEventListener('click', function () { setMakerMode('startA'); });
    document.getElementById('mode-startB').addEventListener('click', function () { setMakerMode('startB'); });
    document.getElementById('mode-flag').addEventListener('click', function () { setMakerMode('flag'); });
    el.btnMakerPlus.addEventListener('click', function () { setMakerLength(1); });
    el.btnMakerMinus.addEventListener('click', function () { setMakerLength(-1); });
    el.makerRope.addEventListener('input', function () {
      maker.rope = parseInt(el.makerRope.value, 10);
      el.makerRopeVal.textContent = String(maker.rope);
    });
    el.btnMakerSave.addEventListener('click', makerSaveAndPlay);
    el.btnMakerBack.addEventListener('click', function () { showScreen('join'); });
  }

  function bindCluster(clusterEl, playerKey) {
    var up = clusterEl.querySelector('.step-btn.up');
    var left = clusterEl.querySelector('.step-btn.left');
    var right = clusterEl.querySelector('.step-btn.right');
    up.addEventListener('click', function () { pressButton(playerKey, 'up'); });
    left.addEventListener('click', function () { pressButton(playerKey, 'left'); });
    right.addEventListener('click', function () { pressButton(playerKey, 'right'); });
  }

  /* ======================= BOOT ======================= */

  function boot() {
    cacheDom();
    loadAchievements();
    loadCustomLevel();
    buildZoomBar();
    buildColorPickers();
    drawJoinFlag();
    wireInput();
    setZoom(100);
    showScreen('join');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
