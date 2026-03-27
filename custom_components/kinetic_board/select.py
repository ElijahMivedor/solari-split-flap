"""Select entity — display mode — for KineticBoard."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL, MODES
from .coordinator import KineticBoardCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up KineticBoard select entities from a config entry."""
    coordinator: KineticBoardCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([KineticBoardModeSelect(coordinator, entry)])


class KineticBoardModeSelect(CoordinatorEntity[KineticBoardCoordinator], SelectEntity):
    """Select entity for the board display mode."""

    _attr_has_entity_name = True
    _attr_translation_key = "mode"
    _attr_options = MODES

    def __init__(
        self, coordinator: KineticBoardCoordinator, entry: ConfigEntry
    ) -> None:
        """Initialise the entity."""
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_mode"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="KineticBoard",
            manufacturer=MANUFACTURER,
            model=MODEL,
        )

    @property
    def current_option(self) -> str | None:
        """Return the currently active mode."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("mode")

    async def async_select_option(self, option: str) -> None:
        """Handle a mode selection."""
        await self.coordinator.async_set_mode(option)
