"""Constants for the kSplitFlap integration."""

# Notes:
# 05/21/2026 - Removed the 'dashboard' mode (and the associated set_location
#              service constant) along with the dashboard feature itself.

DOMAIN = "ksplitflap"
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
MODES = [MODE_QUOTES, MODE_STATIC, MODE_ALTERNATE]

# Service names
SERVICE_SET_STATIC = "set_static_message"
SERVICE_CLEAR_STATIC = "clear_static_message"
SERVICE_ADD_QUOTE = "add_quote"
SERVICE_DELETE_QUOTE = "delete_quote"
