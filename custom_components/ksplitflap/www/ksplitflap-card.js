class KSplitFlapCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._entities = {};
    this._messageDebounce = null;
    this._localMessage = null;
  }

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    this._discoverEntities();
    if (!this._built) {
      this._build();
      this._built = true;
    }
    this._syncState();
  }

  // ── Entity discovery ──────────────────────────────────────────────────────

  _discoverEntities() {
    if (!this._hass?.entities) return;
    const cfg = this._config;

    if (cfg.mode_entity)    this._entities.mode    = cfg.mode_entity;
    if (cfg.volume_entity)  this._entities.volume  = cfg.volume_entity;
    if (cfg.message_entity) this._entities.message = cfg.message_entity;

    if (this._entities.mode && this._entities.volume && this._entities.message) return;

    for (const [id, entry] of Object.entries(this._hass.entities)) {
      if (entry.platform !== 'ksplitflap') continue;
      if (id.startsWith('select.')  && !this._entities.mode)    this._entities.mode    = id;
      if (id.startsWith('number.')  && id.includes('volume') && !this._entities.volume) this._entities.volume  = id;
      if (id.startsWith('text.')    && !this._entities.message) this._entities.message = id;
    }
  }

  // ── Build DOM (once) ──────────────────────────────────────────────────────

  _build() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--primary-font-family, sans-serif);
        }
        ha-card {
          padding: 16px;
        }
        .card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.1rem;
          font-weight: 500;
          color: var(--primary-text-color);
          margin-bottom: 16px;
        }
        .card-header svg {
          flex-shrink: 0;
          opacity: 0.8;
        }
        .row {
          margin-bottom: 16px;
        }
        .row:last-child {
          margin-bottom: 0;
        }
        label {
          display: block;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        textarea {
          width: 100%;
          box-sizing: border-box;
          background: var(--input-fill-color, var(--secondary-background-color));
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          padding: 10px 12px;
          font-family: var(--code-font-family, monospace);
          font-size: 0.95rem;
          resize: vertical;
          min-height: 72px;
          outline: none;
          transition: border-color 0.15s;
        }
        textarea:focus {
          border-color: var(--primary-color);
        }
        textarea::placeholder {
          color: var(--disabled-text-color);
          opacity: 1;
        }
        .hint {
          font-size: 0.72rem;
          color: var(--disabled-text-color);
          margin-top: 4px;
        }
        .mode-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
        }
        .mode-btn {
          padding: 8px 4px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          cursor: pointer;
          text-align: center;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .mode-btn:hover {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border-color: var(--primary-color);
        }
        .mode-btn.active {
          background: var(--primary-color);
          color: var(--text-primary-color, #fff);
          border-color: var(--primary-color);
        }
        .volume-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        input[type=range] {
          flex: 1;
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          background: var(--divider-color);
          outline: none;
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          border: none;
        }
        .volume-value {
          min-width: 32px;
          text-align: right;
          font-size: 0.85rem;
          color: var(--secondary-text-color);
          font-variant-numeric: tabular-nums;
        }
      </style>

      <ha-card>
        <div class="card-header">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 3h18v4H3zm0 6h18v4H3zm0 6h18v4H3z" opacity="0.3"/>
            <rect x="3" y="3" width="18" height="4" rx="1"/>
            <rect x="3" y="9" width="18" height="4" rx="1"/>
            <rect x="3" y="15" width="18" height="4" rx="1"/>
          </svg>
          Split-Flap Display
        </div>

        <div class="row">
          <label>Static Message</label>
          <textarea id="msg" placeholder="Type a message — words wrap automatically"></textarea>
          <div class="hint">Words wrap to 20 chars &amp; center on the board. Clear to remove.</div>
        </div>

        <div class="row">
          <label>Mode</label>
          <div class="mode-grid">
            <button class="mode-btn" data-mode="quotes">Quotes</button>
            <button class="mode-btn" data-mode="static">Static</button>
            <button class="mode-btn" data-mode="alternate">Alternate</button>
            <button class="mode-btn" data-mode="dashboard">Dashboard</button>
          </div>
        </div>

        <div class="row">
          <label>Volume</label>
          <div class="volume-row">
            <input type="range" id="vol" min="0" max="100" step="1" />
            <span class="volume-value" id="vol-label">--</span>
          </div>
        </div>
      </ha-card>
    `;

    // Message textarea — debounce to avoid spamming HA on every keystroke
    const msg = this.shadowRoot.getElementById('msg');
    msg.addEventListener('input', () => {
      this._localMessage = msg.value;
      clearTimeout(this._messageDebounce);
      this._messageDebounce = setTimeout(() => this._setMessage(msg.value), 800);
    });
    msg.addEventListener('blur', () => {
      clearTimeout(this._messageDebounce);
      if (this._localMessage !== null) this._setMessage(msg.value);
    });

    // Mode buttons
    this.shadowRoot.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setMode(btn.dataset.mode));
    });

    // Volume slider
    const vol = this.shadowRoot.getElementById('vol');
    const volLabel = this.shadowRoot.getElementById('vol-label');
    vol.addEventListener('input', () => {
      volLabel.textContent = vol.value + '%';
    });
    vol.addEventListener('change', () => this._setVolume(parseInt(vol.value, 10)));
  }

  // ── Sync state from HA ────────────────────────────────────────────────────

  _syncState() {
    if (!this._hass) return;

    // Mode buttons
    const modeState = this._entities.mode ? this._hass.states[this._entities.mode] : null;
    if (modeState) {
      this.shadowRoot.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === modeState.state);
      });
    }

    // Volume slider — only update if user isn't dragging
    const volState = this._entities.volume ? this._hass.states[this._entities.volume] : null;
    const volEl = this.shadowRoot.getElementById('vol');
    const volLabel = this.shadowRoot.getElementById('vol-label');
    if (volState && volEl && !volEl.matches(':active')) {
      const pct = Math.round(parseFloat(volState.state) * 100);
      volEl.value = pct;
      volLabel.textContent = pct + '%';
    }

    // Message textarea — only update when user isn't typing
    const msgState = this._entities.message ? this._hass.states[this._entities.message] : null;
    const msgEl = this.shadowRoot.getElementById('msg');
    if (msgState && msgEl && this._localMessage === null && document.activeElement !== msgEl) {
      msgEl.value = msgState.state || '';
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  _setMessage(value) {
    this._localMessage = null;
    if (!this._entities.message) return;
    this._hass.callService('text', 'set_value', {
      entity_id: this._entities.message,
      value,
    });
  }

  _setMode(mode) {
    if (!this._entities.mode) return;
    this._hass.callService('select', 'select_option', {
      entity_id: this._entities.mode,
      option: mode,
    });
  }

  _setVolume(pct) {
    if (!this._entities.volume) return;
    this._hass.callService('number', 'set_value', {
      entity_id: this._entities.volume,
      value: (pct / 100).toFixed(2),
    });
  }

  // ── Lovelace card size hint ───────────────────────────────────────────────

  getCardSize() { return 4; }

  static getConfigElement() {
    return document.createElement('ksplitflap-card-editor');
  }

  static getStubConfig() {
    return {};
  }
}

customElements.define('ksplitflap-card', KSplitFlapCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ksplitflap-card',
  name: 'Split-Flap Display',
  description: 'Control your kSplitFlap board — message, mode, and volume.',
});
