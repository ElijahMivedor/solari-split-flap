"""Constants for the KineticBoard integration."""

DOMAIN = "kinetic_board"
MANUFACTURER = "Kinetic"
MODEL = "Split-Flap Display"

CONF_HOST = "host"
CONF_PORT = "port"
CONF_API_KEY = "api_key"

DEFAULT_PORT = 3000
POLL_INTERVAL = 30  # seconds

# API paths
API_STATE = "/api/state"
API_MODE = "/api/mode"
API_STATIC = "/api/static"
API_QUOTES = "/api/quotes"
API_SETTINGS = "/api/settings"

# Modes
MODE_QUOTES = "quotes"
MODE_STATIC = "static"
MODE_ALTERNATE = "alternate"
MODE_DASHBOARD = "dashboard"
MODES = [MODE_QUOTES, MODE_STATIC, MODE_ALTERNATE, MODE_DASHBOARD]

# Service names
SERVICE_SET_STATIC = "set_static_message"
SERVICE_CLEAR_STATIC = "clear_static_message"
SERVICE_ADD_QUOTE = "add_quote"
SERVICE_DELETE_QUOTE = "delete_quote"
SERVICE_SET_LOCATION = "set_location"
