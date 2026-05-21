/* Lovelace card for the kSplitFlap integration. Renders a single ha-card
   that bundles every common control for the board:
     - a live split-flap-styled message preview
     - mode picker (Inspirational Quotes / Custom Message Only / Both)
     - sound on/off
     - volume slider with mute/unmute glyph
     - static message textarea (debounced write-back to HA)
   The card autodiscovers the matching ksplitflap entities (select.*, number.*_volume,
   switch.*_sound, text.*_static_message). All three can also be pinned via
   ksplitflap-card config keys.
   Notes:
   05/21/2026 - Initial rebuild. Mode labels updated to the new
                human-friendly strings, dashboard option removed, sound toggle
                folded into the volume row, and a mini split-flap preview
                added at the top so the card visually echoes the board itself.
                Allman braces throughout. */

class KSplitFlapCard extends HTMLElement
{
    constructor()
    {
        super();
        this.attachShadow({ mode: 'open' });
        this._entities = {};
        this._messageDebounce = null;
        this._localMessage = null;
        this._built = false;
    }

    setConfig(config)
    {
        this._config = config || {};
    }

    set hass(hass)
    {
        this._hass = hass;
        this._discoverEntities();
        if (!this._built)
        {
            this._build();
            this._built = true;
        }
        this._syncState();
    }

    //── Entity discovery ─────────────────────────────────────────────────────
    //Pull explicit entity IDs from the card config first, then fall back to
    //auto-discovery across hass.entities (matching platform === 'ksplitflap').
    _discoverEntities()
    {
        if (!this._hass || !this._hass.entities) return;
        const cfg = this._config;

        if (cfg.mode_entity)    this._entities.mode    = cfg.mode_entity;
        if (cfg.volume_entity)  this._entities.volume  = cfg.volume_entity;
        if (cfg.sound_entity)   this._entities.sound   = cfg.sound_entity;
        if (cfg.message_entity) this._entities.message = cfg.message_entity;

        if (this._entities.mode && this._entities.volume && this._entities.sound && this._entities.message)
        {
            return;
        }

        for (const [id, entry] of Object.entries(this._hass.entities))
        {
            if (entry.platform !== 'ksplitflap') continue;
            if (id.startsWith('select.')  && !this._entities.mode)    this._entities.mode    = id;
            if (id.startsWith('number.')  && id.includes('volume') && !this._entities.volume) this._entities.volume  = id;
            if (id.startsWith('switch.')  && id.includes('sound')  && !this._entities.sound)  this._entities.sound   = id;
            if (id.startsWith('text.')    && !this._entities.message) this._entities.message = id;
        }
    }

    //── DOM template ─────────────────────────────────────────────────────────
    //Built once on the first hass set; later updates only mutate values.
    _build()
    {
        this.shadowRoot.innerHTML = `
            <style>
                :host
                {
                    display: block;
                    font-family: var(--primary-font-family, sans-serif);
                    --sf-accent: var(--primary-color);
                    --sf-flap-bg: #0f1115;
                    --sf-flap-fg: #f5f5f5;
                    --sf-flap-author: #ffc54a;
                    --sf-flap-shadow: 0 6px 18px rgba(0,0,0,0.25);
                }

                ha-card
                {
                    padding: 0;
                    overflow: hidden;
                }

                /* ── Preview strip — looks like a tiny split-flap board ── */
                .preview
                {
                    position: relative;
                    background: var(--sf-flap-bg);
                    padding: 16px 18px 14px;
                    color: var(--sf-flap-fg);
                    box-shadow: inset 0 -1px 0 rgba(255,255,255,0.05);
                }

                .preview::before
                {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 60%);
                    pointer-events: none;
                }

                .preview-eyebrow
                {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.65rem;
                    font-weight: 600;
                    letter-spacing: 0.16em;
                    color: var(--sf-accent);
                    text-transform: uppercase;
                    margin-bottom: 6px;
                }

                .preview-eyebrow .dot
                {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--sf-accent);
                    box-shadow: 0 0 6px var(--sf-accent);
                }

                .preview-text
                {
                    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                    font-weight: 700;
                    font-size: 1.1rem;
                    letter-spacing: 0.04em;
                    line-height: 1.3;
                    white-space: pre-wrap;
                    word-break: break-word;
                    min-height: 2.6em;
                    color: var(--sf-flap-fg);
                }

                .preview-text .author
                {
                    color: var(--sf-flap-author);
                }

                .preview-text.placeholder
                {
                    color: rgba(255,255,255,0.35);
                    font-weight: 500;
                    font-style: italic;
                }

                /* ── Body — controls ── */
                .body
                {
                    padding: 16px 18px 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .row label
                {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 600;
                    color: var(--secondary-text-color);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    margin-bottom: 8px;
                }

                /* ── Mode segmented control ── */
                .mode-grid
                {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 6px;
                    background: var(--divider-color);
                    padding: 4px;
                    border-radius: 12px;
                }

                .mode-btn
                {
                    appearance: none;
                    border: none;
                    background: transparent;
                    color: var(--secondary-text-color);
                    padding: 10px 6px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    line-height: 1.15;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease;
                }

                .mode-btn:hover
                {
                    color: var(--primary-text-color);
                    background: var(--card-background-color);
                }

                .mode-btn.active
                {
                    background: var(--card-background-color);
                    color: var(--primary-text-color);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.18);
                }

                .mode-btn.active::after
                {
                    content: '';
                    display: block;
                    width: 18px;
                    height: 2px;
                    background: var(--sf-accent);
                    border-radius: 1px;
                    margin: 4px auto 0;
                }

                /* ── Volume row with sound toggle ── */
                .volume-row
                {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .sound-toggle
                {
                    flex-shrink: 0;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 1px solid var(--divider-color);
                    background: var(--card-background-color);
                    color: var(--secondary-text-color);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
                }

                .sound-toggle:hover
                {
                    color: var(--primary-text-color);
                    border-color: var(--primary-text-color);
                }

                .sound-toggle.off
                {
                    background: transparent;
                    color: var(--error-color, #db4437);
                    border-color: var(--error-color, #db4437);
                }

                input[type=range]
                {
                    flex: 1;
                    -webkit-appearance: none;
                    appearance: none;
                    height: 4px;
                    border-radius: 2px;
                    background: var(--divider-color);
                    outline: none;
                    cursor: pointer;
                }

                input[type=range]::-webkit-slider-thumb
                {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: var(--sf-accent);
                    border: 2px solid var(--card-background-color);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.25);
                    cursor: pointer;
                }

                input[type=range]::-moz-range-thumb
                {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: var(--sf-accent);
                    border: 2px solid var(--card-background-color);
                    box-shadow: 0 1px 2px rgba(0,0,0,0.25);
                    cursor: pointer;
                }

                .volume-value
                {
                    flex-shrink: 0;
                    min-width: 36px;
                    text-align: right;
                    font-size: 0.85rem;
                    font-variant-numeric: tabular-nums;
                    color: var(--secondary-text-color);
                }

                /* ── Textarea ── */
                textarea
                {
                    width: 100%;
                    box-sizing: border-box;
                    background: var(--secondary-background-color);
                    color: var(--primary-text-color);
                    border: 1px solid var(--divider-color);
                    border-radius: 10px;
                    padding: 10px 12px;
                    font-family: var(--code-font-family, monospace);
                    font-size: 0.95rem;
                    resize: vertical;
                    min-height: 64px;
                    outline: none;
                    transition: border-color 0.18s ease;
                }

                textarea:focus
                {
                    border-color: var(--sf-accent);
                }

                textarea::placeholder
                {
                    color: var(--disabled-text-color);
                    opacity: 1;
                }

                .hint
                {
                    font-size: 0.72rem;
                    color: var(--disabled-text-color);
                    margin-top: 6px;
                }

                .clear-btn
                {
                    margin-top: 6px;
                    background: none;
                    border: none;
                    color: var(--secondary-text-color);
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    cursor: pointer;
                    padding: 0;
                }

                .clear-btn:hover
                {
                    color: var(--primary-text-color);
                }
            </style>

            <ha-card>
                <!-- Mini split-flap preview shows the current mode + active message -->
                <div class="preview">
                    <div class="preview-eyebrow">
                        <span class="dot"></span>
                        <span id="mode-label">—</span>
                    </div>
                    <div class="preview-text placeholder" id="preview-text">No active message</div>
                </div>

                <div class="body">
                    <div class="row">
                        <label>Mode</label>
                        <div class="mode-grid">
                            <button class="mode-btn" data-mode="quotes">Inspirational<br>Quotes</button>
                            <button class="mode-btn" data-mode="static">Custom Message<br>Only</button>
                            <button class="mode-btn" data-mode="alternate">Both</button>
                        </div>
                    </div>

                    <div class="row">
                        <label>Volume</label>
                        <div class="volume-row">
                            <button class="sound-toggle" id="sound-btn" title="Toggle sound">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <path id="sound-icon" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05a4.5 4.5 0 0 0 2.5-4.02zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/>
                                </svg>
                            </button>
                            <input type="range" id="vol" min="0" max="100" step="1" />
                            <span class="volume-value" id="vol-label">--</span>
                        </div>
                    </div>

                    <div class="row">
                        <label>Custom Message</label>
                        <textarea id="msg" placeholder="Type a message — words wrap automatically"></textarea>
                        <div class="hint">Wraps to 20 chars per line and centers on the board.</div>
                        <button class="clear-btn" id="clear-btn">Clear message</button>
                    </div>
                </div>
            </ha-card>
        `;

        //Message textarea — debounce to avoid spamming HA on every keystroke
        const msg = this.shadowRoot.getElementById('msg');
        msg.addEventListener('input', () =>
        {
            this._localMessage = msg.value;
            this._updatePreview();
            clearTimeout(this._messageDebounce);
            this._messageDebounce = setTimeout(() => this._setMessage(msg.value), 800);
        });
        msg.addEventListener('blur', () =>
        {
            clearTimeout(this._messageDebounce);
            if (this._localMessage !== null) this._setMessage(msg.value);
        });

        //Clear button
        this.shadowRoot.getElementById('clear-btn').addEventListener('click', () =>
        {
            msg.value = '';
            this._localMessage = '';
            this._updatePreview();
            this._setMessage('');
        });

        //Mode buttons
        this.shadowRoot.querySelectorAll('.mode-btn').forEach(btn =>
        {
            btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
        });

        //Volume slider
        const vol = this.shadowRoot.getElementById('vol');
        const volLabel = this.shadowRoot.getElementById('vol-label');
        vol.addEventListener('input', () =>
        {
            volLabel.textContent = vol.value + '%';
        });
        vol.addEventListener('change', () => this._setVolume(parseInt(vol.value, 10)));

        //Sound toggle
        this.shadowRoot.getElementById('sound-btn').addEventListener('click', () => this._toggleSound());
    }

    //── Sync state from HA ───────────────────────────────────────────────────

    _syncState()
    {
        if (!this._hass) return;

        //Mode label + active button
        const modeState = this._entities.mode ? this._hass.states[this._entities.mode] : null;
        if (modeState)
        {
            this.shadowRoot.querySelectorAll('.mode-btn').forEach(btn =>
            {
                btn.classList.toggle('active', btn.dataset.mode === modeState.state);
            });
            const label = this.shadowRoot.getElementById('mode-label');
            //Prefer the translated/friendly label HA already computed
            label.textContent = (modeState.attributes && modeState.attributes.friendly_name)
                ? this._modeLabel(modeState.state)
                : this._modeLabel(modeState.state);
        }

        //Volume slider — only update if user isn't dragging
        const volState = this._entities.volume ? this._hass.states[this._entities.volume] : null;
        const volEl = this.shadowRoot.getElementById('vol');
        const volLabel = this.shadowRoot.getElementById('vol-label');
        if (volState && volEl && !volEl.matches(':active'))
        {
            const pct = Math.round(parseFloat(volState.state) * 100);
            volEl.value = pct;
            volLabel.textContent = pct + '%';
        }

        //Sound toggle reflects the switch entity
        const soundState = this._entities.sound ? this._hass.states[this._entities.sound] : null;
        if (soundState)
        {
            const btn = this.shadowRoot.getElementById('sound-btn');
            const isOn = soundState.state === 'on';
            btn.classList.toggle('off', !isOn);
            btn.title = isOn ? 'Click to mute' : 'Click to unmute';
            //Swap to a muted-speaker glyph when sound is off
            const icon = this.shadowRoot.getElementById('sound-icon');
            icon.setAttribute('d', isOn
                ? 'M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05a4.5 4.5 0 0 0 2.5-4.02zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z'
                : 'M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.96 8.96 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z'
            );
        }

        //Message textarea — only update when user isn't typing
        const msgState = this._entities.message ? this._hass.states[this._entities.message] : null;
        const msgEl = this.shadowRoot.getElementById('msg');
        if (msgState && msgEl && this._localMessage === null && document.activeElement !== msgEl)
        {
            msgEl.value = msgState.state || '';
        }

        this._updatePreview();
    }

    //── Preview pane content ─────────────────────────────────────────────────
    //Pulls from the local textarea if the user is typing, otherwise from the
    //message entity state. Empty content falls back to "(no message set)".
    _updatePreview()
    {
        const previewEl = this.shadowRoot.getElementById('preview-text');
        if (!previewEl) return;

        let text = this._localMessage;
        if (text === null || text === undefined)
        {
            const msgState = this._entities.message ? this._hass.states[this._entities.message] : null;
            text = msgState ? (msgState.state || '') : '';
        }
        text = (text || '').trim();

        if (!text)
        {
            previewEl.classList.add('placeholder');
            previewEl.textContent = 'No custom message set';
            return;
        }

        previewEl.classList.remove('placeholder');
        previewEl.innerHTML = '';

        //Honour the @AUTHOR convention with the same gold colouring the board uses
        const lines = text.toUpperCase().split(/\r?\n/);
        lines.forEach((line, i) =>
        {
            const span = document.createElement('span');
            if (line.startsWith('@'))
            {
                span.className = 'author';
                span.textContent = line.substring(1);
            }
            else
            {
                span.textContent = line;
            }
            previewEl.appendChild(span);
            if (i < lines.length - 1) previewEl.appendChild(document.createElement('br'));
        });
    }

    _modeLabel(state)
    {
        switch (state)
        {
            case 'quotes':    return 'Inspirational Quotes';
            case 'static':    return 'Custom Message Only';
            case 'alternate': return 'Both';
            default:          return state || '—';
        }
    }

    //── Actions ──────────────────────────────────────────────────────────────

    _setMessage(value)
    {
        this._localMessage = null;
        if (!this._entities.message) return;
        this._hass.callService('text', 'set_value', {
            entity_id: this._entities.message,
            value,
        });
    }

    _setMode(mode)
    {
        if (!this._entities.mode) return;
        this._hass.callService('select', 'select_option', {
            entity_id: this._entities.mode,
            option: mode,
        });
    }

    _setVolume(pct)
    {
        if (!this._entities.volume) return;
        this._hass.callService('number', 'set_value', {
            entity_id: this._entities.volume,
            value: (pct / 100).toFixed(2),
        });
    }

    _toggleSound()
    {
        if (!this._entities.sound) return;
        const state = this._hass.states[this._entities.sound];
        const isOn = state && state.state === 'on';
        this._hass.callService('switch', isOn ? 'turn_off' : 'turn_on', {
            entity_id: this._entities.sound,
        });
    }

    //── Lovelace card size hint ──────────────────────────────────────────────

    getCardSize() { return 5; }

    static getConfigElement()
    {
        return document.createElement('ksplitflap-card-editor');
    }

    static getStubConfig()
    {
        return {};
    }
}

customElements.define('ksplitflap-card', KSplitFlapCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: 'ksplitflap-card',
    name: 'Split-Flap Display',
    description: 'Control your kSplitFlap board — mode, message, sound, and volume.',
});
