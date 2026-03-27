require('dotenv').config();

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');

const app     = express();
const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'changeme';
const STATE_FILE = path.join(__dirname, 'state.json');

app.use(express.json());
app.use(express.static(__dirname));

const WMO_CODES = {
  0: 'CLEAR SKY', 1: 'MAINLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
  45: 'FOGGY', 48: 'FREEZING FOG',
  51: 'LIGHT DRIZZLE', 53: 'DRIZZLE', 55: 'HEAVY DRIZZLE',
  61: 'LIGHT RAIN', 63: 'RAIN', 65: 'HEAVY RAIN',
  71: 'LIGHT SNOW', 73: 'SNOW', 75: 'HEAVY SNOW', 77: 'SNOW GRAINS',
  80: 'RAIN SHOWERS', 81: 'SHOWERS', 82: 'HEAVY SHOWERS',
  85: 'SNOW SHOWERS', 86: 'HEAVY SNOW SHOWERS',
  95: 'THUNDERSTORM', 96: 'THUNDERSTORM', 99: 'HEAVY THUNDERSTORM'
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

// ─────────────────────────────────────────────
// Seeded quotes
// ─────────────────────────────────────────────
const SEED_QUOTES = [
  ['THE BEST WAY TO', 'PREDICT THE FUTURE', 'IS TO INVENT IT.', '', '@ALAN KAY'],
  ['DESIGN IS NOT JUST', 'WHAT IT LOOKS LIKE.', 'DESIGN IS HOW', 'IT WORKS.', '', '@STEVE JOBS'],
  ['SIMPLICITY IS THE', 'ULTIMATE', 'SOPHISTICATION.', '', '@LEONARDO DA VINCI'],
  ['MAKE IT SIMPLE,', 'BUT SIGNIFICANT.', '', '@DON DRAPER'],
  ['STAY HUNGRY.', 'STAY FOOLISH.', '', '@STEWART BRAND'],
  ['GOOD DESIGN IS', 'AS LITTLE DESIGN', 'AS POSSIBLE.', '', '@DIETER RAMS'],
  ['THE DETAILS ARE NOT', 'THE DETAILS. THEY', 'MAKE THE DESIGN.', '', '@CHARLES EAMES'],
  ['HAVE THE COURAGE', 'TO FOLLOW YOUR', 'HEART AND', 'INTUITION.', '', '@STEVE JOBS'],
  ['I THINK,', 'THEREFORE I AM.', '', '@RENE DESCARTES'],
  ['THE ONLY THING WE', 'HAVE TO FEAR IS', 'FEAR ITSELF.', '', '@FRANKLIN ROOSEVELT'],
  ['IMAGINATION IS', 'MORE IMPORTANT', 'THAN KNOWLEDGE.', '', '@ALBERT EINSTEIN'],
  ['TO BE OR NOT', 'TO BE, THAT IS', 'THE QUESTION.', '', '@SHAKESPEARE'],
  ['IN THE MIDDLE OF', 'DIFFICULTY LIES', 'OPPORTUNITY.', '', '@ALBERT EINSTEIN'],
  ['THE UNEXAMINED', 'LIFE IS NOT WORTH', 'LIVING.', '', '@SOCRATES'],
  ['WE ARE WHAT WE', 'REPEATEDLY DO.', 'EXCELLENCE IS', 'NOT AN ACT,', 'BUT A HABIT.', '', '@ARISTOTLE'],
  ['IF YOU ARE GOING', 'THROUGH HELL,', 'KEEP GOING.', '', '@CHURCHILL'],
  ['BE THE CHANGE YOU', 'WISH TO SEE IN', 'THE WORLD.', '', '@GANDHI'],
  ['THAT WHICH DOES', 'NOT KILL US MAKES', 'US STRONGER.', '', '@NIETZSCHE'],
  ['I HAVE NOT FAILED.', 'I HAVE JUST FOUND', '10000 WAYS THAT', 'WONT WORK.', '', '@THOMAS EDISON'],
  ['THE MEDIUM IS', 'THE MESSAGE.', '', '@MARSHALL MCLUHAN'],
  ['WELCOME TO', 'KINETIC.'],
].map(function(lines) { return { id: genId(), lines: lines }; });

const DEFAULT_STATE = {
  mode: 'quotes',
  sound: true,
  volume: 0.3,
  holdMs: {
    quotes: 8000,
    alternate: { quote: 8000, static: 5000 }
  },
  staticMessage: null,
  quotes: SEED_QUOTES,
  location: { name: 'AUSTIN, TX', lat: 30.2672, lon: -97.7431 },
  weather: null
};

// ─────────────────────────────────────────────
// Load or initialize state
// ─────────────────────────────────────────────
let state;
if (fs.existsSync(STATE_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.warn('Could not parse state.json, using defaults.');
    state = { ...DEFAULT_STATE };
    saveState(state);
  }
} else {
  state = { ...DEFAULT_STATE };
  saveState(state);
  console.log('state.json created with seeded quotes.');
}

if (!state.location) state.location = DEFAULT_STATE.location;
if (state.weather === undefined) state.weather = null;

// ─────────────────────────────────────────────
// Auth — required on all mutating routes
// ─────────────────────────────────────────────
function auth(req, res, next) {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

// Full state — polled by the frontend
app.get('/api/state', (req, res) => {
  res.json(state);
});

// Mode
app.post('/api/mode', auth, (req, res) => {
  const { mode } = req.body;
  if (!['quotes', 'static', 'alternate', 'dashboard'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be quotes | static | alternate | dashboard' });
  }
  state.mode = mode;
  saveState(state);
  res.json(state);
});

// Static message
app.post('/api/static', auth, (req, res) => {
  const { lines } = req.body;
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'lines must be a non-empty array' });
  }
  state.staticMessage = { lines };
  saveState(state);
  res.json(state);
});

app.delete('/api/static', auth, (req, res) => {
  state.staticMessage = null;
  saveState(state);
  res.json(state);
});

// Quotes library
app.get('/api/quotes', (req, res) => {
  res.json(state.quotes);
});

app.post('/api/quotes', auth, (req, res) => {
  const { lines } = req.body;
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'lines must be a non-empty array' });
  }
  const quote = { id: genId(), lines };
  state.quotes.push(quote);
  saveState(state);
  res.status(201).json(quote);
});

app.delete('/api/quotes/:id', auth, (req, res) => {
  const idx = state.quotes.findIndex(q => q.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Quote not found' });
  state.quotes.splice(idx, 1);
  saveState(state);
  res.json({ ok: true });
});

// Settings — volume, sound, holdMs, location
app.post('/api/settings', auth, (req, res) => {
  const { volume, sound, holdMs } = req.body;

  if (volume !== undefined) {
    if (typeof volume !== 'number' || volume < 0 || volume > 1) {
      return res.status(400).json({ error: 'volume must be a number between 0 and 1' });
    }
    state.volume = volume;
  }

  if (sound !== undefined) {
    state.sound = !!sound;
  }

  if (holdMs !== undefined) {
    if (typeof holdMs.quotes === 'number') state.holdMs.quotes = holdMs.quotes;
    if (holdMs.alternate) {
      if (typeof holdMs.alternate.quote === 'number') state.holdMs.alternate.quote = holdMs.alternate.quote;
      if (typeof holdMs.alternate.static === 'number') state.holdMs.alternate.static = holdMs.alternate.static;
    }
  }

  if (req.body.location) {
    const { name, lat, lon } = req.body.location;
    if (typeof lat === 'number' && typeof lon === 'number') {
      state.location = { name: (name || state.location.name).toUpperCase(), lat, lon };
      fetchWeather(); // refresh immediately on location change
    }
  }

  saveState(state);
  res.json(state);
});

// ─────────────────────────────────────────────
// Weather — fetched from Open-Meteo every 10 min
// ─────────────────────────────────────────────
function fetchWeather() {
  const { lat, lon } = state.location;
  const path = `/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago`;
  https.get(`https://api.open-meteo.com${path}`, (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => {
      try {
        const c = JSON.parse(raw).current;
        state.weather = {
          temperature: Math.round(c.temperature_2m),
          condition: WMO_CODES[c.weather_code] || 'UNKNOWN',
          windSpeed: Math.round(c.wind_speed_10m),
          updatedAt: Date.now()
        };
        saveState(state);
        console.log(`Weather: ${state.weather.condition}, ${state.weather.temperature}F, ${state.weather.windSpeed}mph`);
      } catch (e) {
        console.warn('Weather fetch/parse error:', e.message);
      }
    });
  }).on('error', e => console.warn('Weather fetch error:', e.message));
}

fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Solari board running at http://localhost:${PORT}`);
  console.log(`Mode: ${state.mode} | Sound: ${state.sound} | Volume: ${state.volume}`);
});
