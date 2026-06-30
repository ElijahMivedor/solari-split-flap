/* Lovelace card for the kSplitFlap integration. Renders a single ha-card
   that bundles every common control for the board:
     - mode picker (Inspirational Quotes / Custom Message Only / Both)
     - sound on/off
     - volume slider
     - custom message textarea (debounced write-back to HA)
   The card autodiscovers the matching ksplitflap entities (select.*, number.*_volume,
   switch.*_sound, text.*_static_message). All four can also be pinned via
   ksplitflap-card config keys.
   Notes:
   05/21/2026 - Initial rebuild. Mode labels updated to the new
                human-friendly strings, dashboard option removed, sound toggle
                folded into the volume row, and a mini split-flap preview
                added at the top so the card visually echoes the board itself.
                Allman braces throughout.
   05/21/2026 - Visual rewrite to match native HA tile-card styling. Dropped
                the bespoke preview strip, gradient eyebrow, underline-
                segmented mode picker, custom circular sound button, and
                restyled slider thumb in favour of ha-slider, ha-icon-button,
                and ha-icon, with all colours/spacing pulled from HA's CSS
                custom properties so the card inherits whatever theme the
                user has set. */

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
    //All visual styling comes from HA's CSS custom properties — no
    //hardcoded colours, no gradients, no theme-specific assumptions.
    _build()
    {
        this.shadowRoot.innerHTML = `
            <style>
                :host
                {
                    display: block;
                }

                ha-card
                {
                    padding: 12px 16px 16px;
                }

                /* ── Header row ── */
                .header
                {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 4px 0 12px;
                    border-bottom: 1px solid var(--divider-color);
                    margin-bottom: 12px;
                }

                .header-left
                {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                }

                .header-icon
                {
                    color: var(--state-icon-color, var(--primary-text-color));
                    flex-shrink: 0;
                }

                .header-text
                {
                    min-width: 0;
                }

                .name
                {
                    font-weight: 500;
                    font-size: 1rem;
                    color: var(--primary-text-color);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .state
                {
                    font-size: 0.8rem;
                    color: var(--secondary-text-color);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                /* ── Section ── */
                .section + .section
                {
                    margin-top: 16px;
                }

                .label
                {
                    font-size: 0.75rem;
                    color: var(--secondary-text-color);
                    margin-bottom: 8px;
                }

                .label-row
                {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }

                /* ── Mode segmented buttons ── */
                .mode-segments
                {
                    display: flex;
                    gap: 4px;
                    background: var(--secondary-background-color);
                    border-radius: 12px;
                    padding: 3px;
                }

                .seg-btn
                {
                    flex: 1;
                    appearance: none;
                    border: none;
                    background: transparent;
                    color: var(--secondary-text-color);
                    padding: 8px 6px;
                    font-size: 0.82rem;
                    font-family: inherit;
                    line-height: 1.2;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: background-color 0.15s ease, color 0.15s ease;
                }

                .seg-btn:hover
                {
                    color: var(--primary-text-color);
                }

                .seg-btn.active
                {
                    background: var(--primary-color);
                    color: var(--text-primary-color, #fff);
                }

                /* ── Volume + sound row ── */
                .volume-row
                {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .sound-btn
                {
                    flex-shrink: 0;
                    color: var(--secondary-text-color);
                    --mdc-icon-button-size: 36px;
                }

                .sound-btn.muted
                {
                    color: var(--error-color, #db4437);
                }

                ha-slider
                {
                    flex: 1;
                }

                .volume-value
                {
                    flex-shrink: 0;
                    min-width: 38px;
                    text-align: right;
                    font-size: 0.85rem;
                    color: var(--secondary-text-color);
                    font-variant-numeric: tabular-nums;
                }

                /* ── Message ── */
                .message-input
                {
                    width: 100%;
                    box-sizing: border-box;
                    background: var(--secondary-background-color);
                    color: var(--primary-text-color);
                    border: 1px solid var(--divider-color);
                    border-radius: 8px;
                    padding: 10px 12px;
                    font-family: inherit;
                    font-size: 0.95rem;
                    line-height: 1.4;
                    resize: vertical;
                    min-height: 60px;
                    outline: none;
                    transition: border-color 0.15s ease;
                }

                .message-input:focus
                {
                    border-color: var(--primary-color);
                }

                .message-input::placeholder
                {
                    color: var(--disabled-text-color);
                }

                .clear-btn
                {
                    appearance: none;
                    background: none;
                    border: none;
                    color: var(--primary-color);
                    font-family: inherit;
                    font-size: 0.78rem;
                    cursor: pointer;
                    padding: 4px 6px;
                    border-radius: 4px;
                }

                .clear-btn:hover
                {
                    background: var(--secondary-background-color);
                }
            </style>

<ha-card>
                <div class="header">
                    <div class="header-left">
                        <ha-icon class="header-icon" icon="mdi:tray-full"></ha-icon>
                        <div class="header-text">
                            <div class="name">Split-Flap Display</div>
                            <div class="state" id="mode-label">—</div>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="label">Mode</div>
                    <div class="mode-segments">
                        <button class="seg-btn" data-mode="quotes">Inspirational Quotes</button>
                        <button class="seg-btn" data-mode="static">Custom Message Only</button>
                        <button class="seg-btn" data-mode="alternate">Both</button>
                    </div>
                </div>

                <div class="section">
                    <div class="label-row">
                        <div class="label" style="margin: 0">Custom Message</div>
                        <button class="clear-btn" id="clear-btn">Clear</button>
                    </div>
                    <textarea
                        class="message-input"
                        id="msg"
                        placeholder="Type a message — wraps to 20 chars per line"></textarea>
                </div>

                <div class="section">
                    <div class="label">Volume</div>
                    <div class="volume-row">
                        <ha-icon-button class="sound-btn" id="sound-btn" title="Toggle sound">
                            <ha-icon id="sound-icon" icon="mdi:volume-high"></ha-icon>
                        </ha-icon-button>
                        <ha-slider id="vol" min="0" max="100" step="1" pin></ha-slider>
                        <span class="volume-value" id="vol-label">--</span>
                    </div>
                </div>
            </ha-card>
        `;

        //Message textarea — debounce to avoid spamming HA on every keystroke
        const msg = this.shadowRoot.getElementById('msg');
        msg.addEventListener('input', () =>
        {
            this._localMessage = msg.value;
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
            this._setMessage('');
        });

        //Mode buttons
        this.shadowRoot.querySelectorAll('.seg-btn').forEach(btn =>
        {
            btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
        });

        //Volume slider — ha-slider emits 'change' on commit and 'input' while dragging
        const vol = this.shadowRoot.getElementById('vol');
        const volLabel = this.shadowRoot.getElementById('vol-label');
        const updateVolLabel = () =>
        {
            volLabel.textContent = (vol.value !== undefined ? Math.round(vol.value) : 0) + '%';
        };
        vol.addEventListener('input', updateVolLabel);
        vol.addEventListener('change', () =>
        {
            updateVolLabel();
            this._setVolume(Math.round(vol.value));
        });
        //Some ha-slider builds emit value-changed instead of change — handle both
        vol.addEventListener('value-changed', (e) =>
        {
            const v = (e.detail && e.detail.value !== undefined) ? e.detail.value : vol.value;
            volLabel.textContent = Math.round(v) + '%';
            this._setVolume(Math.round(v));
        });

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
            this.shadowRoot.querySelectorAll('.seg-btn').forEach(btn =>
            {
                btn.classList.toggle('active', btn.dataset.mode === modeState.state);
            });
            this.shadowRoot.getElementById('mode-label').textContent = this._modeLabel(modeState.state);
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

        //Sound toggle + speaker glyph
        const soundState = this._entities.sound ? this._hass.states[this._entities.sound] : null;
        if (soundState)
        {
            const btn  = this.shadowRoot.getElementById('sound-btn');
            const icon = this.shadowRoot.getElementById('sound-icon');
            const isOn = soundState.state === 'on';
            btn.classList.toggle('muted', !isOn);
            btn.title = isOn ? 'Click to mute' : 'Click to unmute';
            icon.setAttribute('icon', isOn ? 'mdi:volume-high' : 'mdi:volume-off');
        }

        //Message textarea — only update when user isn't typing
        const msgState = this._entities.message ? this._hass.states[this._entities.message] : null;
        const msgEl = this.shadowRoot.getElementById('msg');
        if (msgState && msgEl && this._localMessage === null && document.activeElement !== msgEl)
        {
            msgEl.value = msgState.state || '';
        }
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

    getCardSize() { return 4; }

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
