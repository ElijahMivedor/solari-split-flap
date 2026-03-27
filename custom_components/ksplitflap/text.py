"""Text entities for kSplitFlap static message lines."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.text import TextEntity, TextMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL
from .coordinator import KSplitFlapCoordinator

_LOGGER = logging.getLogger(__name__)

NUM_LINES = 6


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up kSplitFlap text entities from a config entry."""
    coordinator: KSplitFlapCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        KSplitFlapStaticLine(coordinator, entry, line_num)
        for line_num in range(1, NUM_LINES + 1)
    )


class KSplitFlapStaticLine(CoordinatorEntity[KSplitFlapCoordinator], TextEntity):
    """A text entity representing one line of the static message."""

    _attr_has_entity_name = True
    _attr_mode = TextMode.TEXT
    _attr_native_max = 20
    _attr_native_min = 0

    def __init__(
        self,
        coordinator: KSplitFlapCoordinator,
        entry: ConfigEntry,
        line_num: int,
    ) -> None:
        """Initialise the entity."""
        super().__init__(coordinator)
        self._line_num = line_num
        self._attr_translation_key = f"static_line_{line_num}"
        self._attr_unique_id = f"{entry.entry_id}_static_line_{line_num}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="kSplitFlap",
            manufacturer=MANUFACTURER,
            model=MODEL,
        )

    @property
    def native_value(self) -> str:
        """Return the current line value."""
        if self.coordinator.data is None:
            return ""
        static = self.coordinator.data.get("staticMessage")
        if not static or not isinstance(static.get("lines"), list):
            return ""
        lines = static["lines"]
        idx = self._line_num - 1
        return lines[idx] if idx < len(lines) else ""

    async def async_set_value(self, value: str) -> None:
        """Update this line and push all lines to the board."""
        # Grab current lines from coordinator data
        static = (
            self.coordinator.data.get("staticMessage")
            if self.coordinator.data
            else None
        )
        current_lines: list[str] = []
        if static and isinstance(static.get("lines"), list):
            current_lines = list(static["lines"])

        # Pad to NUM_LINES so we can index freely
        while len(current_lines) < NUM_LINES:
            current_lines.append("")

        # Apply the change (board only accepts uppercase)
        current_lines[self._line_num - 1] = value.upper()

        # Trim trailing blank lines, but keep at least one
        while len(current_lines) > 1 and current_lines[-1] == "":
            current_lines.pop()

        await self.coordinator.async_set_static(current_lines)
