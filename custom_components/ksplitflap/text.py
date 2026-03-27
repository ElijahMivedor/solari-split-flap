"""Text entity for kSplitFlap static message (auto word-wrap + centering)."""
from __future__ import annotations

import logging

from homeassistant.components.text import TextEntity, TextMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL
from .coordinator import KSplitFlapCoordinator

_LOGGER = logging.getLogger(__name__)

BOARD_COLS = 20


def _word_wrap(text: str, width: int) -> list[str]:
    """Wrap text into lines of at most `width` chars without breaking words."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        if not current:
            current = word
        elif len(current) + 1 + len(word) <= width:
            current += " " + word
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _center_h(line: str, width: int) -> str:
    """Center a line horizontally by left-padding with spaces."""
    if len(line) >= width:
        return line[:width]
    pad = (width - len(line)) // 2
    return " " * pad + line


def _build_lines(text: str) -> list[str]:
    """Return board-ready lines: word-wrapped and horizontally centered.

    Vertical centering is handled by the board's own _layoutQuote logic,
    which places lines at startRow = floor((rows - len(lines)) / 2).
    """
    wrapped = _word_wrap(text.upper(), BOARD_COLS)
    return [_center_h(line, BOARD_COLS) for line in wrapped]


def _extract_text(lines: list[str]) -> str:
    """Reconstruct the original message by stripping centering whitespace."""
    return " ".join(line.strip() for line in lines if line.strip())


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the kSplitFlap static message text entity."""
    coordinator: KSplitFlapCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([KSplitFlapStaticMessage(coordinator, entry)])


class KSplitFlapStaticMessage(CoordinatorEntity[KSplitFlapCoordinator], TextEntity):
    """Single text entity for the board's static message.

    Type any message — it is automatically word-wrapped to 20 characters,
    horizontally centered on each line, and vertically centered across the
    8-row board. Clearing the field removes the static message entirely.
    """

    _attr_has_entity_name = True
    _attr_translation_key = "static_message"
    _attr_mode = TextMode.TEXT
    _attr_native_max = 200
    _attr_native_min = 0

    def __init__(
        self,
        coordinator: KSplitFlapCoordinator,
        entry: ConfigEntry,
    ) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_static_message"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="kSplitFlap",
            manufacturer=MANUFACTURER,
            model=MODEL,
        )

    @property
    def native_value(self) -> str:
        """Return the current static message as a single string."""
        if self.coordinator.data is None:
            return ""
        static = self.coordinator.data.get("staticMessage")
        if not static or not isinstance(static.get("lines"), list):
            return ""
        return _extract_text(static["lines"])

    async def async_set_value(self, value: str) -> None:
        """Word-wrap, center, and push the message to the board."""
        if not value.strip():
            await self.coordinator.async_clear_static()
            return
        await self.coordinator.async_set_static(_build_lines(value.strip()))
