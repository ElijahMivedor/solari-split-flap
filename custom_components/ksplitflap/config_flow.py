"""Config flow for kSplitFlap."""
from __future__ import annotations

import logging
from typing import Any

import aiohttp
import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    API_SETTINGS,
    API_STATE,
    CONF_API_KEY,
    CONF_HOST,
    CONF_PORT,
    DEFAULT_PORT,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_HOST): str,
        vol.Optional(CONF_PORT, default=DEFAULT_PORT): vol.Coerce(int),
        vol.Required(CONF_API_KEY): str,
    }
)


class KSplitFlapConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for kSplitFlap."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial user step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            host: str = user_input[CONF_HOST].strip().rstrip("/")
            port: int = user_input[CONF_PORT]
            api_key: str = user_input[CONF_API_KEY].strip()
            base_url = f"http://{host}:{port}"

            # Set unique_id and abort if already configured
            await self.async_set_unique_id(f"{host}:{port}")
            self._abort_if_unique_id_configured()

            session = async_get_clientsession(self.hass)

            # 1. Connectivity check — GET /api/state must return 200
            try:
                async with session.get(
                    f"{base_url}{API_STATE}",
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
                        errors["base"] = "cannot_connect"
            except aiohttp.ClientConnectorError:
                errors["base"] = "cannot_connect"
            except aiohttp.ClientError:
                errors["base"] = "cannot_connect"
            except Exception:  # noqa: BLE001
                _LOGGER.exception("Unexpected error during connectivity check")
                errors["base"] = "unknown"

            # 2. Auth check — POST /api/settings with empty body; expect non-401
            if not errors:
                try:
                    async with session.post(
                        f"{base_url}{API_SETTINGS}",
                        json={},
                        headers={"X-API-Key": api_key},
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as resp:
                        if resp.status == 401:
                            errors["api_key"] = "invalid_auth"
                except aiohttp.ClientError:
                    errors["base"] = "cannot_connect"
                except Exception:  # noqa: BLE001
                    _LOGGER.exception("Unexpected error during auth check")
                    errors["base"] = "unknown"

            if not errors:
                return self.async_create_entry(
                    title=f"kSplitFlap ({host}:{port})",
                    data={
                        CONF_HOST: host,
                        CONF_PORT: port,
                        CONF_API_KEY: api_key,
                    },
                )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )
