"""The kSplitFlap integration."""
from __future__ import annotations

import logging
import os
from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ConfigEntryNotReady, ServiceNotFound
from homeassistant.helpers import config_validation as cv

from .const import (
    DOMAIN,
    SERVICE_ADD_QUOTE,
    SERVICE_CLEAR_STATIC,
    SERVICE_DELETE_QUOTE,
    SERVICE_SET_LOCATION,
    SERVICE_SET_STATIC,
)
from .coordinator import KSplitFlapCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[str] = ["select", "number", "switch", "text"]

_CARD_URL  = "/ksplitflap/ksplitflap-card.js"
_CARD_FILE = os.path.join(os.path.dirname(__file__), "www", "ksplitflap-card.js")

# ------------------------------------------------------------------ #
# Service schemas
# ------------------------------------------------------------------ #

SET_STATIC_SCHEMA = vol.Schema(
    {
        vol.Required("lines"): vol.All(cv.ensure_list, [cv.string]),
    }
)

ADD_QUOTE_SCHEMA = vol.Schema(
    {
        vol.Required("lines"): vol.All(cv.ensure_list, [cv.string]),
    }
)

DELETE_QUOTE_SCHEMA = vol.Schema(
    {
        vol.Required("quote_id"): cv.string,
    }
)

SET_LOCATION_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Required("lat"): vol.Coerce(float),
        vol.Required("lon"): vol.Coerce(float),
    }
)


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def _get_coordinator(hass: HomeAssistant) -> KSplitFlapCoordinator:
    """Return the first registered coordinator (one board per HA install is the common case)."""
    entries = hass.data.get(DOMAIN, {})
    if not entries:
        raise vol.Invalid("No kSplitFlap integration is configured.")
    # Return coordinator for the first entry found
    return next(iter(entries.values()))


# ------------------------------------------------------------------ #
# Setup
# ------------------------------------------------------------------ #

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Register the Lovelace card as a static frontend asset."""
    try:
        from homeassistant.components.http import StaticPathConfig
        await hass.http.async_register_static_paths(
            [StaticPathConfig(_CARD_URL, _CARD_FILE, cache_headers=False)]
        )
    except (ImportError, AttributeError):
        hass.http.register_static_path(_CARD_URL, _CARD_FILE, cache_headers=False)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up kSplitFlap from a config entry."""
    coordinator = KSplitFlapCoordinator(hass, entry)

    # Initial data fetch — raises ConfigEntryNotReady on failure
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    # Forward setup to entity platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register services only once (guard against duplicate registrations when
    # multiple config entries exist, which is unlikely but handled safely)
    _register_services(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
        # If no more entries remain, remove the services too
        if not hass.data[DOMAIN]:
            _unregister_services(hass)

    return unload_ok


# ------------------------------------------------------------------ #
# Service registration
# ------------------------------------------------------------------ #

def _register_services(hass: HomeAssistant) -> None:
    """Register integration-level services, skipping any already registered."""

    if not hass.services.has_service(DOMAIN, SERVICE_SET_STATIC):
        async def handle_set_static(call: ServiceCall) -> None:
            coordinator = _get_coordinator(hass)
            lines: list[str] = call.data["lines"]
            await coordinator.async_set_static(lines)

        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_STATIC,
            handle_set_static,
            schema=SET_STATIC_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_CLEAR_STATIC):
        async def handle_clear_static(call: ServiceCall) -> None:
            coordinator = _get_coordinator(hass)
            await coordinator.async_clear_static()

        hass.services.async_register(
            DOMAIN,
            SERVICE_CLEAR_STATIC,
            handle_clear_static,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_ADD_QUOTE):
        async def handle_add_quote(call: ServiceCall) -> None:
            coordinator = _get_coordinator(hass)
            lines: list[str] = call.data["lines"]
            await coordinator.async_add_quote(lines)

        hass.services.async_register(
            DOMAIN,
            SERVICE_ADD_QUOTE,
            handle_add_quote,
            schema=ADD_QUOTE_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_DELETE_QUOTE):
        async def handle_delete_quote(call: ServiceCall) -> None:
            coordinator = _get_coordinator(hass)
            quote_id: str = call.data["quote_id"]
            await coordinator.async_delete_quote(quote_id)

        hass.services.async_register(
            DOMAIN,
            SERVICE_DELETE_QUOTE,
            handle_delete_quote,
            schema=DELETE_QUOTE_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_LOCATION):
        async def handle_set_location(call: ServiceCall) -> None:
            coordinator = _get_coordinator(hass)
            await coordinator.async_set_location(
                call.data["name"],
                call.data["lat"],
                call.data["lon"],
            )

        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_LOCATION,
            handle_set_location,
            schema=SET_LOCATION_SCHEMA,
        )


def _unregister_services(hass: HomeAssistant) -> None:
    """Remove all integration services when the last entry is removed."""
    for service in (
        SERVICE_SET_STATIC,
        SERVICE_CLEAR_STATIC,
        SERVICE_ADD_QUOTE,
        SERVICE_DELETE_QUOTE,
        SERVICE_SET_LOCATION,
    ):
        if hass.services.has_service(DOMAIN, service):
            hass.services.async_remove(DOMAIN, service)
