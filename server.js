/* Solari board backend. Serves the static frontend, persists settings to
   state.json, exposes a small JSON API (mode / static / quotes / settings)
   guarded by an API key, and bridges MQTT topics into the same actions so
   Home Assistant automations can drive the board.
   Notes:
   05/21/2026 - Removed the 'dashboard' mode along with the Open-Meteo
                weather fetch, the WMO_CODES table, the location config,
                and the matching API/MQTT/HA hooks. The frontend no longer
                renders a dashboard so none of this code is reachable.
   05/21/2026 - Reformatted to Allman braces. */

require('dotenv').config();

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const mqtt    = require('mqtt');

const app        = express();
const PORT       = process.env.PORT || 3000;
const API_KEY    = process.env.API_KEY || 'changeme';
const STATE_FILE = path.join(__dirname, 'state.json');

app.use(express.json());
app.use(express.static(__dirname));

//Modes accepted by both the HTTP API and the MQTT bridge.
const VALID_MODES = ['quotes', 'static', 'alternate'];

//─────────────────────────────────────────────
//Helpers
//─────────────────────────────────────────────
function genId()
{
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function saveState(s)
{
    fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

//─────────────────────────────────────────────
//Seeded quotes
//─────────────────────────────────────────────
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
    quotes: SEED_QUOTES
};

//─────────────────────────────────────────────
//Load or initialize state
//─────────────────────────────────────────────
let state;
if (fs.existsSync(STATE_FILE))
{
    try
    {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    catch (e)
    {
        console.warn('Could not parse state.json, using defaults.');
        state = { ...DEFAULT_STATE };
        saveState(state);
    }
}
else
{
    state = { ...DEFAULT_STATE };
    saveState(state);
    console.log('state.json created with seeded quotes.');
}

//Migrate older state files: drop dashboard mode and any leftover weather/location keys
if (state.mode === 'dashboard') state.mode = 'quotes';
if (state.location) delete state.location;
if (state.weather)  delete state.weather;

//─────────────────────────────────────────────
//Auth — required on all mutating routes
//─────────────────────────────────────────────
function auth(req, res, next)
{
    if (req.headers['x-api-key'] !== API_KEY)
    {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

//─────────────────────────────────────────────
//Routes
//─────────────────────────────────────────────

//Full state — polled by the frontend
app.get('/api/state', (req, res) =>
{
    res.json(state);
});

//Mode
app.post('/api/mode', auth, (req, res) =>
{
    const { mode } = req.body;
    if (!VALID_MODES.includes(mode))
    {
        return res.status(400).json({ error: 'mode must be ' + VALID_MODES.join(' | ') });
    }
    state.mode = mode;
    saveState(state);
    res.json(state);
});

//Static message
app.post('/api/static', auth, (req, res) =>
{
    const { lines } = req.body;
    if (!Array.isArray(lines) || lines.length === 0)
    {
        return res.status(400).json({ error: 'lines must be a non-empty array' });
    }
    state.staticMessage = { lines };
    saveState(state);
    res.json(state);
});

app.delete('/api/static', auth, (req, res) =>
{
    state.staticMessage = null;
    saveState(state);
    res.json(state);
});

//Quotes library
app.get('/api/quotes', (req, res) =>
{
    res.json(state.quotes);
});

app.post('/api/quotes', auth, (req, res) =>
{
    const { lines } = req.body;
    if (!Array.isArray(lines) || lines.length === 0)
    {
        return res.status(400).json({ error: 'lines must be a non-empty array' });
    }
    const quote = { id: genId(), lines };
    state.quotes.push(quote);
    saveState(state);
    res.status(201).json(quote);
});

app.delete('/api/quotes/:id', auth, (req, res) =>
{
    const idx = state.quotes.findIndex(q => q.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Quote not found' });
    state.quotes.splice(idx, 1);
    saveState(state);
    res.json({ ok: true });
});

//Settings — volume, sound, holdMs
app.post('/api/settings', auth, (req, res) =>
{
    const { volume, sound, holdMs } = req.body;

    if (volume !== undefined)
    {
        if (typeof volume !== 'number' || volume < 0 || volume > 1)
        {
            return res.status(400).json({ error: 'volume must be a number between 0 and 1' });
        }
        state.volume = volume;
    }

    if (sound !== undefined)
    {
        state.sound = !!sound;
    }

    if (holdMs !== undefined)
    {
        if (typeof holdMs.quotes === 'number') state.holdMs.quotes = holdMs.quotes;
        if (holdMs.alternate)
        {
            if (typeof holdMs.alternate.quote === 'number') state.holdMs.alternate.quote = holdMs.alternate.quote;
            if (typeof holdMs.alternate.static === 'number') state.holdMs.alternate.static = holdMs.alternate.static;
        }
    }

    saveState(state);
    res.json(state);
});

//─────────────────────────────────────────────
//MQTT
//─────────────────────────────────────────────
if (process.env.MQTT_HOST)
{
    const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT || 1883}`, {
        username: process.env.MQTT_USER,
        password: process.env.MQTT_PASSWORD,
        reconnectPeriod: 5000
    });

    mqttClient.on('connect', () =>
    {
        console.log(`MQTT connected to ${process.env.MQTT_HOST}:${process.env.MQTT_PORT || 1883}`);
        mqttClient.subscribe([
            'solari/mode',
            'solari/static',
            'solari/static/clear',
            'solari/settings',
            'solari/quotes/add'
        ]);
    });

    mqttClient.on('message', (topic, payload) =>
    {
        const raw = payload.toString().trim();
        try
        {
            if (topic === 'solari/mode')
            {
                const mode = raw.replace(/^"|"$/g, '');
                if (VALID_MODES.includes(mode))
                {
                    state.mode = mode;
                    saveState(state);
                    console.log(`MQTT: mode → ${mode}`);
                }
            }
            else if (topic === 'solari/static')
            {
                let lines;
                if (raw.startsWith('{'))
                {
                    lines = JSON.parse(raw).lines;
                }
                else
                {
                    lines = [raw.toUpperCase()];
                }
                if (Array.isArray(lines) && lines.length > 0)
                {
                    state.staticMessage = { lines };
                    saveState(state);
                    console.log('MQTT: static message set');
                }
            }
            else if (topic === 'solari/static/clear')
            {
                state.staticMessage = null;
                saveState(state);
                console.log('MQTT: static message cleared');
            }
            else if (topic === 'solari/settings')
            {
                const data = JSON.parse(raw);
                if (typeof data.volume === 'number') state.volume = Math.max(0, Math.min(1, data.volume));
                if (typeof data.sound === 'boolean') state.sound = data.sound;
                saveState(state);
                console.log('MQTT: settings updated');
            }
            else if (topic === 'solari/quotes/add')
            {
                const data = JSON.parse(raw);
                if (Array.isArray(data.lines) && data.lines.length > 0)
                {
                    const quote = { id: genId(), lines: data.lines };
                    state.quotes.push(quote);
                    saveState(state);
                    console.log('MQTT: quote added');
                }
            }
        }
        catch (e)
        {
            console.warn(`MQTT: failed to handle message on ${topic}:`, e.message);
        }
    });

    mqttClient.on('error', err => console.warn('MQTT error:', err.message));
}

//─────────────────────────────────────────────
//Start
//─────────────────────────────────────────────
app.listen(PORT, () =>
{
    console.log(`Solari board running at http://localhost:${PORT}`);
    console.log(`Mode: ${state.mode} | Sound: ${state.sound} | Volume: ${state.volume}`);
});
