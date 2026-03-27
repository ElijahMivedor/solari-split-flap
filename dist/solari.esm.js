/**
 * solari-split-flap v1.0.0
 * A physically accurate split-flap (Solari board) display.
 * MIT License
 */
/**
 * solari-split-flap
 * A physically accurate split-flap (Solari board) display.
 * https://github.com/nicedoc/solari-split-flap
 * MIT License
 */

// ──────────────────────────────────────────────
// Inject CSS (only once per document)
// ──────────────────────────────────────────────
var CSS_INJECTED = false;
var CSS_TEXT = ':root{--sf-body-bg:#111;--sf-board-bg:#1a1a1a;--sf-flap-top:#2a2a2a;--sf-flap-bottom:#222;--sf-gap-line:#111;--sf-text:#f0f0f0;--sf-author:#f5c542}.split-flap-board{display:flex;flex-direction:column;gap:3px;padding:2rem;background:var(--sf-board-bg);border-radius:12px;width:fit-content;margin:2rem auto;overflow:hidden;transition:background 0.4s ease}.split-flap-row{display:flex;gap:3px}.split-flap-cell{width:28px;height:40px;perspective:200px}.flap-display{position:relative;width:100%;height:100%;font-family:"SF Mono","Fira Code","Fira Mono","Roboto Mono","Courier New",monospace;font-size:1.1rem;font-weight:bold;color:var(--sf-text);text-align:center;transition:color 0.4s ease}.flap-top{position:absolute;top:0;left:0;width:100%;height:calc(50% - 0.25px);background:var(--sf-flap-top);border-radius:4px 4px 0 0;clip-path:polygon(0 0,100% 0,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));overflow:hidden;z-index:1;transition:background 0.4s ease}.flap-top .flap-char{position:absolute;top:0;left:0;width:100%;height:200%;display:flex;align-items:center;justify-content:center;line-height:1}.flap-bottom{position:absolute;bottom:0;left:0;width:100%;height:calc(50% - 0.25px);background:var(--sf-flap-bottom);border-radius:0 0 4px 4px;clip-path:polygon(3px 0,calc(100% - 3px) 0,100% 3px,100% 100%,0 100%,0 3px);overflow:hidden;z-index:1;transition:background 0.4s ease}.flap-bottom .flap-char{position:absolute;bottom:0;left:0;width:100%;height:200%;display:flex;align-items:center;justify-content:center;line-height:1}.flap-flip{position:absolute;top:0;left:0;width:100%;height:50%;transform-origin:bottom center;transform-style:preserve-3d;z-index:10;pointer-events:none;display:none}.flap-flip.flipping{display:block;animation:flapDown 0.15s ease-in forwards}.flap-flip-front{position:absolute;top:0;left:0;width:100%;height:100%;background:var(--sf-flap-top);border-radius:4px 4px 0 0;clip-path:polygon(0 0,100% 0,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px));backface-visibility:hidden;overflow:hidden;transition:background 0.4s ease}.flap-flip-front .flap-char{position:absolute;top:0;left:0;width:100%;height:200%;display:flex;align-items:center;justify-content:center;line-height:1}.flap-flip-back{position:absolute;top:0;left:0;width:100%;height:100%;background:var(--sf-flap-bottom);border-radius:0 0 4px 4px;clip-path:polygon(3px 0,calc(100% - 3px) 0,100% 3px,100% 100%,0 100%,0 3px);backface-visibility:hidden;transform:rotateX(180deg);overflow:hidden;transition:background 0.4s ease}.flap-flip-back .flap-char{position:absolute;bottom:0;left:0;width:100%;height:200%;display:flex;align-items:center;justify-content:center;line-height:1}.split-flap-cell.author-cell .flap-top .flap-char,.split-flap-cell.author-cell .flap-bottom .flap-char,.split-flap-cell.author-cell .flap-flip-front .flap-char,.split-flap-cell.author-cell .flap-flip-back .flap-char{color:var(--sf-author)}@keyframes flapDown{0%{transform:rotateX(0deg)}100%{transform:rotateX(-180deg)}}@media (max-width:768px){.split-flap-cell{width:18px;height:28px}.flap-display{font-size:0.75rem}.split-flap-board{gap:2px;padding:1rem}.split-flap-row{gap:2px}}@media (max-width:480px){.split-flap-cell{width:14px;height:22px}.flap-display{font-size:0.6rem}}'; // replaced by build script

function injectCSS() {
  if (CSS_INJECTED) return;
  if (typeof document === 'undefined') return;
  // If the placeholder was not replaced (running from src), skip injection
  if (CSS_TEXT === '__SOLARI_' + 'CSS__') return;
  var style = document.createElement('style');
  style.setAttribute('data-solari', '');
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
  CSS_INJECTED = true;
}

// ──────────────────────────────────────────────
// Theme engine
// ──────────────────────────────────────────────

function hsl(h, s, l) {
  return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
}

/**
 * Generate a complete theme object from HSL parameters.
 *
 * Physics: light comes from above.
 *   - Top flap: lighter (catches light)
 *   - Bottom flap: darker (in shadow)
 *   - Board bg: darkest (recessed behind flaps)
 *   - Gap line: matches board bg (shadow between flaps)
 *   - Body bg: slightly darker/lighter than board for depth
 *
 * @param {number} hue - 0-360
 * @param {number} sat - 0-100
 * @param {string} mode - 'dark' or 'light'
 * @returns {Object} Theme object with CSS color values
 */
function generateTheme(hue, sat, mode) {
  if (mode === 'dark') {
    return {
      bodyBg:     hsl(hue, sat, 6),
      boardBg:    hsl(hue, sat, 10),
      flapTop:    hsl(hue, sat, 18),
      flapBottom: hsl(hue, sat, 14),
      gapLine:    hsl(hue, sat, 6),
      text:       hsl(hue, Math.min(sat, 10), 94),
      author:     sat === 0 ? hsl(45, 85, 60) : hsl(hue, 85, 72)
    };
  } else {
    return {
      bodyBg:     hsl(hue, sat, 95),
      boardBg:    hsl(hue, sat, 88),
      flapTop:    hsl(hue, sat, 82),
      flapBottom: hsl(hue, sat, 76),
      gapLine:    hsl(hue, sat, 70),
      text:       hsl(hue, sat, 10),
      author:     sat === 0 ? hsl(45, 85, 42) : hsl(hue, Math.max(sat, 40), 35)
    };
  }
}

// Preset themes
var THEMES = {
  classic:   { hue: 0,   sat: 0,  mode: 'dark' },
  mint:      { hue: 155, sat: 30, mode: 'dark' },
  ocean:     { hue: 210, sat: 35, mode: 'dark' },
  purple:    { hue: 270, sat: 30, mode: 'dark' },
  amber:     { hue: 35,  sat: 40, mode: 'dark' },
  rose:      { hue: 345, sat: 25, mode: 'dark' },
  fog:       { hue: 0,   sat: 0,  mode: 'light' },
  sage:      { hue: 140, sat: 15, mode: 'light' },
  lavender:  { hue: 260, sat: 20, mode: 'light' }
};

// Default quotes
var DEFAULT_QUOTES = [
  ['THE BEST WAY TO',
   'PREDICT THE FUTURE',
   'IS TO INVENT IT.',
   '',
   '@ALAN KAY'],

  ['DESIGN IS NOT JUST',
   'WHAT IT LOOKS LIKE.',
   'DESIGN IS HOW',
   'IT WORKS.',
   '',
   '@STEVE JOBS'],

  ['SIMPLICITY IS THE',
   'ULTIMATE',
   'SOPHISTICATION.',
   '',
   '@LEONARDO DA VINCI'],

  ['MAKE IT SIMPLE,',
   'BUT SIGNIFICANT.',
   '',
   '@DON DRAPER'],

  ['STAY HUNGRY.',
   'STAY FOOLISH.',
   '',
   '@STEWART BRAND'],

  ['GOOD DESIGN IS',
   'AS LITTLE DESIGN',
   'AS POSSIBLE.',
   '',
   '@DIETER RAMS'],

  ['THE DETAILS ARE NOT',
   'THE DETAILS. THEY',
   'MAKE THE DESIGN.',
   '',
   '@CHARLES EAMES'],

  ['HAVE THE COURAGE',
   'TO FOLLOW YOUR',
   'HEART AND',
   'INTUITION.',
   '',
   '@STEVE JOBS'],

  ['I THINK,',
   'THEREFORE I AM.',
   '',
   '@RENE DESCARTES'],

  ['THE ONLY THING WE',
   'HAVE TO FEAR IS',
   'FEAR ITSELF.',
   '',
   '@FRANKLIN ROOSEVELT'],

  ['IMAGINATION IS',
   'MORE IMPORTANT',
   'THAN KNOWLEDGE.',
   '',
   '@ALBERT EINSTEIN'],

  ['TO BE OR NOT',
   'TO BE, THAT IS',
   'THE QUESTION.',
   '',
   '@SHAKESPEARE'],

  ['IN THE MIDDLE OF',
   'DIFFICULTY LIES',
   'OPPORTUNITY.',
   '',
   '@ALBERT EINSTEIN'],

  ['THE UNEXAMINED',
   'LIFE IS NOT WORTH',
   'LIVING.',
   '',
   '@SOCRATES'],

  ['WE ARE WHAT WE',
   'REPEATEDLY DO.',
   'EXCELLENCE IS',
   'NOT AN ACT,',
   'BUT A HABIT.',
   '',
   '@ARISTOTLE'],

  ['IF YOU ARE GOING',
   'THROUGH HELL,',
   'KEEP GOING.',
   '',
   '@CHURCHILL'],

  ['BE THE CHANGE YOU',
   'WISH TO SEE IN',
   'THE WORLD.',
   '',
   '@GANDHI'],

  ['THAT WHICH DOES',
   'NOT KILL US MAKES',
   'US STRONGER.',
   '',
   '@NIETZSCHE'],

  ['I HAVE NOT FAILED.',
   'I HAVE JUST FOUND',
   '10000 WAYS THAT',
   'WONT WORK.',
   '',
   '@THOMAS EDISON'],

  ['THE MEDIUM IS',
   'THE MESSAGE.',
   '',
   '@MARSHALL MCLUHAN']
];

// ──────────────────────────────────────────────
// Drum — fixed character sequence
// ──────────────────────────────────────────────
var DRUM = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;!?\'-';
var DRUM_INDEX = {};
for (var di = 0; di < DRUM.length; di++) DRUM_INDEX[DRUM[di]] = di;

// ──────────────────────────────────────────────
// Shuffle utility
// ──────────────────────────────────────────────
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// ──────────────────────────────────────────────
// SolariBoard class
// ──────────────────────────────────────────────

/**
 * @param {HTMLElement} container - DOM element to render the board into
 * @param {Object} [options]
 * @param {number} [options.cols=20] - Characters per row
 * @param {number} [options.rows=8] - Number of rows
 * @param {number} [options.flipMs=150] - Single flap animation duration (ms)
 * @param {number} [options.charDelay=50] - Stagger between cells in cascade (ms)
 * @param {number} [options.holdMs=5000] - Hold finished quote before cycling (ms)
 * @param {Array} [options.quotes] - Array of quote arrays (each quote is array of lines)
 * @param {string|Object} [options.theme='classic'] - Preset name or {hue, sat, mode}
 * @param {boolean} [options.sound=true] - Enable mechanical click sounds
 */
function SolariBoard(container, options) {
  if (!container) throw new Error('SolariBoard: container element required');
  options = options || {};

  this._container = container;
  this._cols = options.cols || 20;
  this._rows = options.rows || 8;
  this._flipMs = options.flipMs || 150;
  this._charDelay = options.charDelay || 50;
  this._holdMs = options.holdMs || 5000;
  this._quotes = options.quotes || DEFAULT_QUOTES;
  this._soundEnabled = options.sound !== false;
  this._running = false;
  this._destroyed = false;
  this._cycleTimeout = null;

  // Inject CSS into the document
  injectCSS();

  // Update flip animation duration if non-default
  this._animDuration = this._flipMs / 1000;

  // Build DOM
  this._buildDOM();

  // Audio
  this._audioCtx = null;
  this._audioReady = false;
  this._initAudioBound = this._initAudio.bind(this);
  if (this._soundEnabled) {
    document.addEventListener('click', this._initAudioBound, { once: true });
    document.addEventListener('keydown', this._initAudioBound, { once: true });
  }

  // Apply theme
  if (options.theme) {
    this.setTheme(options.theme);
  }
}

// ──────────────────────────────────────────────
// Static members
// ──────────────────────────────────────────────

/** Access preset themes */
SolariBoard.themes = THEMES;

/**
 * Generate a theme from HSL parameters.
 * @param {number} hue - 0-360
 * @param {number} sat - 0-100
 * @param {string} mode - 'dark' or 'light'
 * @returns {Object} Theme object
 */
SolariBoard.generateTheme = generateTheme;

// ──────────────────────────────────────────────
// Prototype
// ──────────────────────────────────────────────

SolariBoard.prototype._buildDOM = function() {
  var board = this._container;
  board.classList.add('split-flap-board');
  board.innerHTML = '';

  for (var r = 0; r < this._rows; r++) {
    var row = document.createElement('div');
    row.className = 'split-flap-row';
    for (var c = 0; c < this._cols; c++) {
      row.innerHTML +=
        '<div class="split-flap-cell">' +
          '<div class="flap-display">' +
            '<div class="flap-top"><span class="flap-char">&nbsp;</span></div>' +
            '<div class="flap-bottom"><span class="flap-char">&nbsp;</span></div>' +
            '<div class="flap-flip">' +
              '<div class="flap-flip-front"><span class="flap-char">&nbsp;</span></div>' +
              '<div class="flap-flip-back"><span class="flap-char">&nbsp;</span></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
    board.appendChild(row);
  }

  this._cells = board.querySelectorAll('.split-flap-cell');
  var totalCells = this._cols * this._rows;
  this._currentChars = [];
  this._cellTimers = [];
  for (var i = 0; i < totalCells; i++) {
    this._currentChars.push(' ');
    this._cellTimers.push([]);
  }

  // Set custom animation duration if needed
  if (this._flipMs !== 150) {
    var styleEl = document.createElement('style');
    styleEl.textContent = '.split-flap-board .flap-flip.flipping { animation-duration: ' + this._animDuration + 's; }';
    board.appendChild(styleEl);
  }
};

// ──────────────────────────────────────────────
// Theme
// ──────────────────────────────────────────────

/**
 * Apply a theme.
 * @param {string|Object} theme - Preset name (e.g. 'mint') or {hue, sat, mode}
 */
SolariBoard.prototype.setTheme = function(theme) {
  var colors;
  if (typeof theme === 'string') {
    var preset = THEMES[theme];
    if (!preset) throw new Error('SolariBoard: unknown theme "' + theme + '"');
    colors = generateTheme(preset.hue, preset.sat, preset.mode);
    this._currentThemeConfig = preset;
  } else {
    colors = generateTheme(theme.hue, theme.sat, theme.mode);
    this._currentThemeConfig = theme;
  }
  this._applyColors(colors);
};

SolariBoard.prototype._applyColors = function(colors) {
  var el = this._container;
  el.style.setProperty('--sf-board-bg', colors.boardBg);
  el.style.setProperty('--sf-flap-top', colors.flapTop);
  el.style.setProperty('--sf-flap-bottom', colors.flapBottom);
  el.style.setProperty('--sf-gap-line', colors.gapLine);
  el.style.setProperty('--sf-text', colors.text);
  el.style.setProperty('--sf-author', colors.author);

  // Body bg is set on container's parent or document if it's the body
  // We apply it as a data attribute so consumers can read it
  el.dataset.sfBodyBg = colors.bodyBg;
  this._currentColors = colors;
};

// ──────────────────────────────────────────────
// Audio
// ──────────────────────────────────────────────

SolariBoard.prototype._initAudio = function() {
  if (this._audioCtx) return;
  try {
    this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this._audioReady = true;
  } catch(e) {
    this._audioReady = false;
  }
};

SolariBoard.prototype._playClick = function() {
  if (!this._soundEnabled || !this._audioReady || !this._audioCtx) return;
  var ctx = this._audioCtx;
  var duration = 0.012;
  var now = ctx.currentTime;
  var bufferSize = Math.ceil(ctx.sampleRate * duration);
  var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  var data = buffer.getChannelData(0);
  for (var i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  var source = ctx.createBufferSource();
  source.buffer = buffer;
  var filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000 + Math.random() * 1000;
  filter.Q.value = 1.5;
  var gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08 + Math.random() * 0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
};

// ──────────────────────────────────────────────
// Cell timer management
// ──────────────────────────────────────────────

SolariBoard.prototype._cancelCell = function(index) {
  var timers = this._cellTimers[index];
  for (var t = 0; t < timers.length; t++) clearTimeout(timers[t]);
  this._cellTimers[index] = [];
};

SolariBoard.prototype._cancelAll = function() {
  var total = this._cols * this._rows;
  for (var i = 0; i < total; i++) this._cancelCell(i);
  if (this._cycleTimeout) {
    clearTimeout(this._cycleTimeout);
    this._cycleTimeout = null;
  }
};

// ──────────────────────────────────────────────
// Flip a single cell to a new character
// ──────────────────────────────────────────────

SolariBoard.prototype._flipCell = function(index, newChar) {
  var cell = this._cells[index];
  if (!cell) return;

  var oldChar = this._currentChars[index];
  if (oldChar === newChar) return;

  var topChar = cell.querySelector('.flap-top .flap-char');
  var bottomChar = cell.querySelector('.flap-bottom .flap-char');
  var flip = cell.querySelector('.flap-flip');
  var flipFront = cell.querySelector('.flap-flip-front .flap-char');
  var flipBack = cell.querySelector('.flap-flip-back .flap-char');

  flip.classList.remove('flipping');

  flipFront.textContent = oldChar;
  flipBack.textContent = newChar;
  bottomChar.textContent = newChar;

  void flip.offsetWidth;
  flip.classList.add('flipping');
  this._playClick();

  var self = this;
  var tid = setTimeout(function() {
    topChar.textContent = newChar;
    flip.classList.remove('flipping');
    self._currentChars[index] = newChar;
  }, this._flipMs);
  this._cellTimers[index].push(tid);
};

// ──────────────────────────────────────────────
// Drum cycle — spin forward through every
// intermediate character (like real hardware).
// Fast at start, decelerates toward the end.
// ──────────────────────────────────────────────

SolariBoard.prototype._drumToChar = function(index, targetChar, baseDelay) {
  this._cancelCell(index);

  var fromIdx = DRUM_INDEX[this._currentChars[index]];
  var toIdx = DRUM_INDEX[targetChar];
  if (fromIdx === undefined) fromIdx = 0;
  if (toIdx === undefined) toIdx = 0;

  var steps = [];
  var pos = fromIdx;
  while (pos !== toIdx) {
    pos = (pos + 1) % DRUM.length;
    steps.push(DRUM[pos]);
  }

  if (steps.length === 0) return 0;

  var minGap = 35;
  var maxGap = 160;
  var cumulative = 0;
  var self = this;

  for (var s = 0; s < steps.length; s++) {
    var progress = s / steps.length;
    var gap = minGap + (maxGap - minGap) * progress * progress;
    var tid = (function(t, ch) {
      return setTimeout(function() {
        self._flipCell(index, ch);
      }, baseDelay + t);
    })(cumulative, steps[s]);
    this._cellTimers[index].push(tid);
    cumulative += gap;
  }

  return cumulative + this._flipMs;
};

// ──────────────────────────────────────────────
// Layout — center quote block on the board.
// Quote lines left-aligned, author right-aligned.
// ──────────────────────────────────────────────

SolariBoard.prototype._layoutQuote = function(lines) {
  var COLS = this._cols;
  var ROWS = this._rows;
  var grid = [];
  var authorRows = {};

  for (var r = 0; r < ROWS; r++) {
    var row = [];
    for (var c = 0; c < COLS; c++) row.push(' ');
    grid.push(row);
  }

  var usedRows = Math.min(lines.length, ROWS);
  var startRow = Math.floor((ROWS - usedRows) / 2);

  for (var l = 0; l < usedRows; l++) {
    var line = lines[l] || '';
    var isAuthor = line.charAt(0) === '@';
    if (isAuthor) line = line.substring(1);
    if (line.length > COLS) line = line.substring(0, COLS);
    var pad = isAuthor ? (COLS - line.length) : 0;
    if (isAuthor) authorRows[startRow + l] = true;
    for (var ch = 0; ch < line.length; ch++) {
      grid[startRow + l][pad + ch] = line[ch];
    }
  }

  return { grid: grid, authorRows: authorRows };
};

// ──────────────────────────────────────────────
// Display — cascade drum cycles across the board
// ──────────────────────────────────────────────

SolariBoard.prototype._displayQuote = function(result, callback) {
  var grid = result.grid;
  var authorRows = result.authorRows;
  var COLS = this._cols;
  var ROWS = this._rows;
  var maxDrumTime = 0;
  var self = this;

  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var idx = r * COLS + c;
      var target = grid[r][c];
      var delay = (r * COLS + c) * this._charDelay;

      if (this._currentChars[idx] !== target) {
        var drumTime = this._drumToChar(idx, target, delay);
        if (delay + drumTime > maxDrumTime) maxDrumTime = delay + drumTime;
      }

      // Schedule author class change per-cell after its drum finishes
      (function(cellIdx, row, cellDelay) {
        var tid = setTimeout(function() {
          if (authorRows[row]) {
            self._cells[cellIdx].classList.add('author-cell');
          } else {
            self._cells[cellIdx].classList.remove('author-cell');
          }
        }, cellDelay + self._flipMs + 50);
        self._cellTimers[cellIdx].push(tid);
      })(idx, r, delay);
    }
  }

  this._cycleTimeout = setTimeout(callback, maxDrumTime + this._holdMs);
};

// ──────────────────────────────────────────────
// Quotes
// ──────────────────────────────────────────────

/**
 * Update the quotes list.
 * @param {Array} quotes - Array of quote arrays
 */
SolariBoard.prototype.setQuotes = function(quotes) {
  this._quotes = quotes;
  this._shuffled = shuffle(quotes);
  this._qIndex = 0;
};

// ──────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────

/**
 * Start cycling quotes.
 */
SolariBoard.prototype.start = function() {
  if (this._destroyed) return;
  if (this._running) return;
  this._running = true;
  this._shuffled = shuffle(this._quotes);
  this._qIndex = 0;

  var self = this;
  function cycle() {
    if (!self._running) return;
    var quote = self._shuffled[self._qIndex % self._shuffled.length];
    var result = self._layoutQuote(quote);
    self._displayQuote(result, function() {
      self._qIndex++;
      cycle();
    });
  }

  this._cycleTimeout = setTimeout(function() { cycle(); }, 800);
};

/**
 * Stop cycling quotes. The current display remains.
 */
SolariBoard.prototype.stop = function() {
  this._running = false;
  this._cancelAll();
};

/**
 * Clean up: stop cycling, remove DOM content, close audio.
 */
SolariBoard.prototype.destroy = function() {
  this.stop();
  this._destroyed = true;

  // Remove audio listeners
  if (this._initAudioBound) {
    document.removeEventListener('click', this._initAudioBound);
    document.removeEventListener('keydown', this._initAudioBound);
  }

  // Close audio context
  if (this._audioCtx) {
    try { this._audioCtx.close(); } catch(e) {}
    this._audioCtx = null;
  }

  // Clear DOM
  this._container.innerHTML = '';
  this._container.classList.remove('split-flap-board');
  this._cells = null;
  this._currentChars = null;
  this._cellTimers = null;
};

// ──────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────




export { SolariBoard, generateTheme, THEMES as themes, DEFAULT_QUOTES as defaultQuotes };
export default SolariBoard;
