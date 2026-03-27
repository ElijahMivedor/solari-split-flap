"""Switch entity — sound — for KineticBoard."""
from __future__ import annotations

import logging

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL
from .coordinator import KineticBoardCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up KineticBoard switch entities from a config entry."""
    coordinator: KineticBoardCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([KineticBoardSoundSwitch(coordinator, entry)])


class KineticBoardSoundSwitch(
    CoordinatorEntity[KineticBoardCoordinator], SwitchEntity
):
    """Switch entity to enable/disable board sound."""

    _attr_has_entity_name = True
    _attr_translation_key = "sound"

    def __init__(
        self, coordinator: KineticBoardCoordinator, entry: ConfigEntry
    ) -> None:
        """Initialise the entity."""
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_sound"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="KineticBoard",
            manufacturer=MANUFACTURER,
            model=MODEL,
        )

    @property
    def is_on(self) -> bool | None:
        """Return True when sound is enabled."""
        if self.coordinator.data is None:
            return None
        return bool(self.coordinator.data.get("sound"))

    async def async_turn_on(self, **kwargs: object) -> None:
        """Enable sound."""
        await self.coordinator.async_set_sound(True)

    async def async_turn_off(self, **kwargs: object) -> None:
        """Disable sound."""
        await self.coordinator.async_set_sound(False)
