# KineticBoard — Home Assistant Integration

Control your Solari split-flap display directly from Home Assistant. The **KineticBoard** integration polls your board's local Express server every 30 seconds and exposes entities for every controllable setting. Four custom services let you push messages and manage the quote library from automations, scripts, and dashboards.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation via HACS](#installation-via-hacs)
3. [Manual Installation](#manual-installation)
4. [Configuration (Config Flow)](#configuration-config-flow)
5. [Entities](#entities)
6. [Services](#services)
7. [Dashboard Mode](#dashboard-mode)
8. [Example Automations](#example-automations)
9. [Configuration.yaml REST Commands (non-HACS)](#configurationyaml-rest-commands-non-hacs)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Home Assistant 2024.1.0 or newer
- The Solari board server (`server.js`) running and reachable from your Home Assistant host
- The board server's `API_KEY` value (set in the server's `.env` file — defaults to `changeme`)
- The hostname or IP address of the machine running the server, and the port it listens on (default **3000**)

Verify the server is reachable before adding the integration:

```bash
curl http://<board-host>:3000/api/state
```

You should receive a JSON object containing `mode`, `sound`, `volume`, and `quotes`.

---

## Installation via HACS

HACS (Home Assistant Community Store) is the recommended installation method.

1. Open **HACS** in your Home Assistant sidebar.
2. Click **Integrations**, then the **⋮** menu in the top-right corner and choose **Custom repositories**.
3. Paste the repository URL:
   ```
   https://github.com/elimivedore/solari-split-flap
   ```
   Category: **Integration**. Click **Add**.
4. Search for **KineticBoard** in the HACS integrations list and click **Download**.
5. Restart Home Assistant.
6. Proceed to [Configuration](#configuration-config-flow).

---

## Manual Installation

If you prefer not to use HACS:

1. Download or clone the repository:
   ```bash
   git clone https://github.com/elimivedore/solari-split-flap.git
   ```
2. Copy the integration folder into your HA config directory:
   ```bash
   cp -r solari-split-flap/custom_components/kinetic_board \
         /config/custom_components/kinetic_board
   ```
   Your directory structure should look like:
   ```
   /config/
   └── custom_components/
       └── kinetic_board/
           ├── __init__.py
           ├── manifest.json
           ├── const.py
           ├── config_flow.py
           ├── coordinator.py
           ├── select.py
           ├── number.py
           ├── switch.py
           ├── services.yaml
           ├── strings.json
           └── translations/
               └── en.json
   ```
3. Restart Home Assistant.
4. Proceed to [Configuration](#configuration-config-flow).

---

## Configuration (Config Flow)

After installation and restart, add the integration through the UI:

1. Go to **Settings → Devices & Services → Add Integration**.
2. Search for **KineticBoard** and click it.
3. Fill in the form:

   | Field   | Description                                                         | Example          |
   |---------|---------------------------------------------------------------------|------------------|
   | Host    | IP address or hostname of the machine running the board server      | `192.168.1.42`   |
   | Port    | Port the Express server listens on (default 3000)                   | `3000`           |
   | API Key | The `API_KEY` from the server's `.env` file (default `changeme`)   | `changeme`       |

4. Click **Submit**. Home Assistant will:
   - Verify connectivity by calling `GET /api/state`
   - Verify the API key by calling `POST /api/settings` with an empty body and checking for a non-401 response
5. If validation succeeds, a **KineticBoard** device is created with six entities.

To reconfigure or remove the integration, go to **Settings → Devices & Services → KineticBoard → ⋮**.

---

## Entities

All entities are grouped under a single **KineticBoard** device (manufacturer: Kinetic, model: Split-Flap Display).

### Mode (Select)

| Attribute   | Value                                |
|-------------|--------------------------------------|
| Entity ID   | `select.kineticboard_mode`           |
| Unique ID   | `{entry_id}_mode`                    |
| Options     | `quotes`, `static`, `alternate`      |
| Writable    | Yes — changes call `POST /api/mode`  |

Controls how the board cycles content:

- **quotes** — rotates through the quote library automatically
- **static** — displays the saved static message indefinitely
- **alternate** — alternates between the static message and the quote library
- **dashboard** — shows live date, time, and weather (see [Dashboard Mode](#dashboard-mode))

---

### Volume (Number)

| Attribute   | Value                                         |
|-------------|-----------------------------------------------|
| Entity ID   | `number.kineticboard_volume`                  |
| Unique ID   | `{entry_id}_volume`                           |
| Range       | 0.00 – 1.00 (step 0.01)                       |
| Unit        | None (dimensionless)                          |
| Writable    | Yes — changes call `POST /api/settings`       |

Controls the volume of the mechanical flip sound effect. `0.0` is silent, `1.0` is maximum.

---

### Sound (Switch)

| Attribute   | Value                                         |
|-------------|-----------------------------------------------|
| Entity ID   | `switch.kineticboard_sound`                   |
| Unique ID   | `{entry_id}_sound`                            |
| Writable    | Yes — changes call `POST /api/settings`       |

Enables or disables the flip sound effect entirely. When off, the board animates silently regardless of the Volume setting.

---

### Quotes Hold Duration (Number)

| Attribute   | Value                                                         |
|-------------|---------------------------------------------------------------|
| Entity ID   | `number.kineticboard_quotes_hold_duration`                    |
| Unique ID   | `{entry_id}_hold_quotes`                                      |
| Range       | 1 – 300 seconds (step 1)                                      |
| Unit        | seconds                                                       |
| Writable    | Yes — stores as milliseconds via `POST /api/settings`         |

How long each quote is displayed before the board flips to the next one (in **quotes** and **alternate** modes).

---

### Alternate Quote Hold (Number)

| Attribute   | Value                                                                |
|-------------|----------------------------------------------------------------------|
| Entity ID   | `number.kineticboard_alternate_quote_hold`                           |
| Unique ID   | `{entry_id}_hold_alternate_quote`                                    |
| Range       | 1 – 300 seconds (step 1)                                             |
| Unit        | seconds                                                              |
| Writable    | Yes — stores as milliseconds via `POST /api/settings`                |

In **alternate** mode: how long a quote from the library is held before switching to the static message.

---

### Alternate Static Hold (Number)

| Attribute   | Value                                                                |
|-------------|----------------------------------------------------------------------|
| Entity ID   | `number.kineticboard_alternate_static_hold`                          |
| Unique ID   | `{entry_id}_hold_alternate_static`                                   |
| Range       | 1 – 300 seconds (step 1)                                             |
| Unit        | seconds                                                              |
| Writable    | Yes — stores as milliseconds via `POST /api/settings`                |

In **alternate** mode: how long the static message is held before switching back to a quote.

---

## Services

All services live under the `kinetic_board` domain and can be called from automations, scripts, the Developer Tools, or the HA dashboard.

---

### `kinetic_board.set_static_message`

Display a static message on the board.

| Field  | Type           | Required | Description                                   |
|--------|----------------|----------|-----------------------------------------------|
| lines  | list of strings| Yes      | Each string is one line. Use `""` for blank.  |

Text is stored as-is; the board UI renders it in uppercase. Use an `@` prefix on a line for author attribution styling (e.g. `@ALAN KAY`).

```yaml
service: kinetic_board.set_static_message
data:
  lines:
    - "WELCOME HOME"
    - ""
    - "@KINETIC"
```

---

### `kinetic_board.clear_static_message`

Remove the stored static message. The board retains its current mode.

```yaml
service: kinetic_board.clear_static_message
```

---

### `kinetic_board.add_quote`

Add a new quote to the board's quote library. It is immediately available for display.

| Field  | Type           | Required | Description                         |
|--------|----------------|----------|-------------------------------------|
| lines  | list of strings| Yes      | Lines of the quote, author on last. |

```yaml
service: kinetic_board.add_quote
data:
  lines:
    - "THE BEST WAY OUT"
    - "IS ALWAYS THROUGH."
    - ""
    - "@ROBERT FROST"
```

---

### `kinetic_board.delete_quote`

Remove a quote from the library by its ID.

| Field    | Type   | Required | Description                    |
|----------|--------|----------|--------------------------------|
| quote_id | string | Yes      | The ID returned by the server. |

To find quote IDs, call `GET http://<board-host>:3000/api/quotes` — each quote object contains an `id` field.

```yaml
service: kinetic_board.delete_quote
data:
  quote_id: "lf2k3abc1"
```

---

### `kinetic_board.set_location`

Set the geographic location used for weather data in dashboard mode. Triggers an immediate weather refresh on the server.

| Field | Type   | Required | Description                                     |
|-------|--------|----------|-------------------------------------------------|
| name  | string | Yes      | Display name shown on the board (e.g. AUSTIN, TX). |
| lat   | float  | Yes      | Latitude coordinate (-90 to 90).               |
| lon   | float  | Yes      | Longitude coordinate (-180 to 180).            |

```yaml
service: kinetic_board.set_location
data:
  name: "NEW YORK, NY"
  lat: 40.7128
  lon: -74.0060
```

---

## Dashboard Mode

Dashboard mode turns the board into a live information display. When active, the board shows:

- **Row 1:** Current date in `DATE  DD/MM/YYYY` format (CST timezone)
- **Row 2:** Current time in `TIME  HH:MM:SS` format (CST timezone, updates every second)
- **Row 4:** Location name (e.g. `AUSTIN, TX`)
- **Row 5:** Weather condition (e.g. `PARTLY CLOUDY`)
- **Row 6:** Temperature and wind speed (e.g. `72F  WIND 8 MPH`)

Weather data is fetched from [Open-Meteo](https://open-meteo.com/) — a free, no-API-key weather service — every 10 minutes. Temperature is in Fahrenheit and wind speed in mph.

Time updates every second using direct single-flip animation (not the full drum cycle), so only cells that have changed characters are animated. Weather rows update automatically whenever the server fetches new data.

The default location is Austin, TX. Change it with the `kinetic_board.set_location` service or by posting to `POST /api/settings` with a `location` object.

### Switching to dashboard mode

```yaml
service: select.select_option
target:
  entity_id: select.kineticboard_mode
data:
  option: dashboard
```

### Automation: Switch to dashboard at night

```yaml
alias: KineticBoard Dashboard at Night
trigger:
  - platform: time
    at: "20:00:00"
action:
  - service: select.select_option
    target:
      entity_id: select.kineticboard_mode
    data:
      option: dashboard

---

alias: KineticBoard Quotes in Morning
trigger:
  - platform: time
    at: "08:00:00"
action:
  - service: select.select_option
    target:
      entity_id: select.kineticboard_mode
    data:
      option: quotes
```

### Setting the location

```yaml
service: kinetic_board.set_location
data:
  name: "CHICAGO, IL"
  lat: 41.8781
  lon: -87.6298
```

---

## Example Automations

### Welcome Home Message

Shows a personal greeting when someone arrives home, then switches back to quotes after 60 seconds.

```yaml
alias: KineticBoard Welcome Home
trigger:
  - platform: state
    entity_id: person.jane
    to: home
action:
  - service: select.select_option
    target:
      entity_id: select.kineticboard_mode
    data:
      option: static
  - service: kinetic_board.set_static_message
    data:
      lines:
        - "WELCOME HOME"
        - "JANE"
        - ""
        - "@KINETIC"
  - delay:
      seconds: 60
  - service: select.select_option
    target:
      entity_id: select.kineticboard_mode
    data:
      option: quotes
```

---

### Morning Quote of the Day

Switches to quotes mode and sets maximum volume every morning at 8:00 AM.

```yaml
alias: KineticBoard Morning
trigger:
  - platform: time
    at: "08:00:00"
action:
  - service: select.select_option
    target:
      entity_id: select.kineticboard_mode
    data:
      option: quotes
  - service: switch.turn_on
    target:
      entity_id: switch.kineticboard_sound
  - service: number.set_value
    target:
      entity_id: number.kineticboard_volume
    data:
      value: 0.5
```

---

### Mute Sound at Night

Silences the flip sound between 22:00 and 07:00.

```yaml
alias: KineticBoard Mute at Night
trigger:
  - platform: time
    at: "22:00:00"
action:
  - service: switch.turn_off
    target:
      entity_id: switch.kineticboard_sound

---

alias: KineticBoard Unmute in Morning
trigger:
  - platform: time
    at: "07:00:00"
action:
  - service: switch.turn_on
    target:
      entity_id: switch.kineticboard_sound
```

---

### Show Weather Conditions on the Board

Displays the current outside temperature as a static message when it is unusually hot or cold.

```yaml
alias: KineticBoard Weather Alert
trigger:
  - platform: numeric_state
    entity_id: weather.home
    attribute: temperature
    above: 35
condition: []
action:
  - service: kinetic_board.set_static_message
    data:
      lines:
        - "IT IS HOT OUT THERE"
        - >-
          {{ states('sensor.outdoor_temperature') }}°C
        - ""
        - "STAY HYDRATED"
  - service: select.select_option
    target:
      entity_id: select.kineticboard_mode
    data:
      option: static
```

---

### Add a Daily Inspirational Quote (Template)

Adds a templated quote to the board library every Monday morning.

```yaml
alias: KineticBoard Monday Motivation
trigger:
  - platform: time
    at: "07:30:00"
condition:
  - condition: time
    weekday:
      - mon
action:
  - service: kinetic_board.add_quote
    data:
      lines:
        - "MAKE THIS WEEK"
        - "COUNT."
        - ""
        - "@KINETIC"
```

---

## Configuration.yaml REST Commands (non-HACS)

If you cannot use HACS or the custom integration, you can control the board using Home Assistant's built-in `rest_command` integration. Add the following to your `configuration.yaml`:

```yaml
rest_command:
  kineticboard_set_mode:
    url: "http://192.168.1.42:3000/api/mode"
    method: POST
    headers:
      X-API-Key: "changeme"
      Content-Type: "application/json"
    payload: '{"mode": "{{ mode }}"}'

  kineticboard_set_static:
    url: "http://192.168.1.42:3000/api/static"
    method: POST
    headers:
      X-API-Key: "changeme"
      Content-Type: "application/json"
    payload: '{"lines": {{ lines | tojson }}}'

  kineticboard_clear_static:
    url: "http://192.168.1.42:3000/api/static"
    method: DELETE
    headers:
      X-API-Key: "changeme"

  kineticboard_set_volume:
    url: "http://192.168.1.42:3000/api/settings"
    method: POST
    headers:
      X-API-Key: "changeme"
      Content-Type: "application/json"
    payload: '{"volume": {{ volume }}}'

  kineticboard_set_sound:
    url: "http://192.168.1.42:3000/api/settings"
    method: POST
    headers:
      X-API-Key: "changeme"
      Content-Type: "application/json"
    payload: '{"sound": {{ sound }}}'

  kineticboard_add_quote:
    url: "http://192.168.1.42:3000/api/quotes"
    method: POST
    headers:
      X-API-Key: "changeme"
      Content-Type: "application/json"
    payload: '{"lines": {{ lines | tojson }}}'
```

Replace `192.168.1.42` and `changeme` with your actual host and API key. After adding these commands and restarting HA, call them from automations:

```yaml
service: rest_command.kineticboard_set_mode
data:
  mode: quotes

service: rest_command.kineticboard_set_static
data:
  lines:
    - "HELLO WORLD"
    - "@KINETIC"
```

---

## Troubleshooting

### "Could not reach the board server" during setup

- Confirm the Node server is running: `node server.js` or check your process manager.
- Ensure the host and port are correct and that no firewall is blocking port 3000.
- Test from the HA host: `curl http://<board-host>:3000/api/state`
- If HA runs in Docker or a VM, use the host machine's LAN IP address, not `localhost`.

### "The API key was rejected" during setup

- Open the `.env` file in the board project directory and check the value of `API_KEY`.
- The default key is `changeme` — if you changed it, use the new value.
- Whitespace matters: ensure there are no leading or trailing spaces in the key.

### Entities show "Unavailable"

- The coordinator failed to fetch state. Check **Settings → System → Logs** for `kinetic_board` errors.
- Verify the server is still running and reachable.
- If the server was restarted on a different port, remove and re-add the integration.

### State is stale / not updating

- The integration polls every 30 seconds. State changes made outside HA will appear within 30 seconds.
- To force an immediate refresh, call the `homeassistant.update_entity` service on any KineticBoard entity.

### Services do not appear in Developer Tools

- Ensure the integration is set up and at least one entry is loaded.
- Services are registered when the first config entry loads and removed when the last one is deleted.
- Check the logs for any errors during `async_setup_entry`.

### Multiple boards

If you have more than one board, add the integration multiple times (each with a different host/port). Services (`kinetic_board.set_static_message`, etc.) will target the **first** configured board. For precise multi-board control, use the `select`, `number`, and `switch` entities directly — or call the board's HTTP API via `rest_command` with distinct URLs.

### Resetting to defaults

To restore the board to its default state, stop the server, delete `state.json` from the project directory, and restart the server. The file will be recreated with seed quotes and default settings.
