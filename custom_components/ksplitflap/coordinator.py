"""DataUpdateCoordinator for kSplitFlap."""
from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import aiohttp
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import (
    API_MODE,
    API_QUOTES,
    API_SETTINGS,
    API_STATE,
    API_STATIC,
    CONF_API_KEY,
    CONF_HOST,
    CONF_PORT,
    DOMAIN,
    POLL_INTERVAL,
)

_LOGGER = logging.getLogger(__name__)


class KSplitFlapCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator that polls GET /api/state and exposes mutation helpers."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialise the coordinator."""
        self.config_entry = entry
        host: str = entry.data[CONF_HOST]
        port: int = entry.data[CONF_PORT]
        self._base_url = f"http://{host}:{port}"
        self._api_key: str = entry.data[CONF_API_KEY]

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=POLL_INTERVAL),
        )

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _session(self) -> aiohttp.ClientSession:
        return async_get_clientsession(self.hass)

    def _auth_headers(self) -> dict[str, str]:
        return {"X-API-Key": self._api_key}

    async def _get(self, path: str) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        session = self._session()
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            resp.raise_for_status()
            return await resp.json()

    async def _post(
        self,
        path: str,
        payload: dict[str, Any] | None = None,
        *,
        auth: bool = True,
    ) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        session = self._session()
        headers = self._auth_headers() if auth else {}
        async with session.post(
            url,
            json=payload or {},
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 401:
                raise ConfigEntryAuthFailed("Invalid API key")
            resp.raise_for_status()
            return await resp.json()

    async def _delete(self, path: str) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        session = self._session()
        async with session.delete(
            url,
            headers=self._auth_headers(),
            timeout=aiohttp.ClientTimeout(total=10),
        ) as resp:
            if resp.status == 401:
                raise ConfigEntryAuthFailed("Invalid API key")
            resp.raise_for_status()
            return await resp.json()

    # ------------------------------------------------------------------ #
    # DataUpdateCoordinator protocol
    # ------------------------------------------------------------------ #

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch state from the board."""
        try:
            return await self._get(API_STATE)
        except ConfigEntryAuthFailed:
            raise
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"Error communicating with kSplitFlap: {err}") from err

    # ------------------------------------------------------------------ #
    # Mutation helpers (each mutates then refreshes coordinator data)
    # ------------------------------------------------------------------ #

    async def async_set_mode(self, mode: str) -> None:
        """Set the display mode."""
        await self._post(API_MODE, {"mode": mode})
        await self.async_refresh()

    async def async_set_volume(self, volume: float) -> None:
        """Set the volume (0.0 – 1.0)."""
        await self._post(API_SETTINGS, {"volume": round(volume, 2)})
        await self.async_refresh()

    async def async_set_sound(self, sound: bool) -> None:
        """Enable or disable sound."""
        await self._post(API_SETTINGS, {"sound": sound})
        await self.async_refresh()

    async def async_set_hold(self, hold_payload: dict[str, Any]) -> None:
        """Update holdMs settings.

        hold_payload examples:
          {"quotes": 8000}
          {"alternate": {"quote": 8000}}
          {"alternate": {"static": 5000}}
        """
        await self._post(API_SETTINGS, {"holdMs": hold_payload})
        await self.async_refresh()

    async def async_set_static(self, lines: list[str]) -> None:
        """Set the static message."""
        await self._post(API_STATIC, {"lines": lines})
        await self.async_refresh()

    async def async_clear_static(self) -> None:
        """Clear the static message."""
        await self._delete(API_STATIC)
        await self.async_refresh()

    async def async_add_quote(self, lines: list[str]) -> None:
        """Add a quote to the library."""
        await self._post(API_QUOTES, {"lines": lines})
        await self.async_refresh()

    async def async_delete_quote(self, quote_id: str) -> None:
        """Delete a quote from the library by ID."""
        await self._delete(f"{API_QUOTES}/{quote_id}")
        await self.async_refresh()

    async def async_set_location(self, name: str, lat: float, lon: float) -> None:
        """Set the weather location for dashboard mode."""
        await self._post(
            API_SETTINGS,
            {"location": {"name": name.upper(), "lat": lat, "lon": lon}},
        )
        await self.async_refresh()
