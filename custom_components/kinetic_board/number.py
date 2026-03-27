"""Number entities for KineticBoard."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable

from homeassistant.components.number import (
    NumberDeviceClass,
    NumberEntity,
    NumberEntityDescription,
    NumberMode,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL
from .coordinator import KineticBoardCoordinator

_LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True, kw_only=True)
class KineticBoardNumberDescription(NumberEntityDescription):
    """Describes a KineticBoard number entity."""

    # Extracts the current value (in display units) from coordinator data
    value_fn: Callable[[dict[str, Any]], float | None]
    # Sends the updated value (in display units) to the board
    set_fn: Callable[[KineticBoardCoordinator, float], Any]


def _hold_quotes_value(data: dict[str, Any]) -> float | None:
    try:
        return data["holdMs"]["quotes"] / 1000
    except (KeyError, TypeError):
        return None


def _hold_alt_quote_value(data: dict[str, Any]) -> float | None:
    try:
        return data["holdMs"]["alternate"]["quote"] / 1000
    except (KeyError, TypeError):
        return None


def _hold_alt_static_value(data: dict[str, Any]) -> float | None:
    try:
        return data["holdMs"]["alternate"]["static"] / 1000
    except (KeyError, TypeError):
        return None


ENTITY_DESCRIPTIONS: tuple[KineticBoardNumberDescription, ...] = (
    KineticBoardNumberDescription(
        key="volume",
        translation_key="volume",
        native_min_value=0.0,
        native_max_value=1.0,
        native_step=0.01,
        native_unit_of_measurement=None,
        mode=NumberMode.SLIDER,
        value_fn=lambda data: data.get("volume"),
        set_fn=lambda coord, v: coord.async_set_volume(v),
    ),
    KineticBoardNumberDescription(
        key="hold_quotes",
        translation_key="hold_quotes",
        native_min_value=1,
        native_max_value=300,
        native_step=1,
        native_unit_of_measurement=UnitOfTime.SECONDS,
        mode=NumberMode.BOX,
        value_fn=_hold_quotes_value,
        set_fn=lambda coord, v: coord.async_set_hold({"quotes": int(v * 1000)}),
    ),
    KineticBoardNumberDescription(
        key="hold_alternate_quote",
        translation_key="hold_alternate_quote",
        native_min_value=1,
        native_max_value=300,
        native_step=1,
        native_unit_of_measurement=UnitOfTime.SECONDS,
        mode=NumberMode.BOX,
        value_fn=_hold_alt_quote_value,
        set_fn=lambda coord, v: coord.async_set_hold(
            {"alternate": {"quote": int(v * 1000)}}
        ),
    ),
    KineticBoardNumberDescription(
        key="hold_alternate_static",
        translation_key="hold_alternate_static",
        native_min_value=1,
        native_max_value=300,
        native_step=1,
        native_unit_of_measurement=UnitOfTime.SECONDS,
        mode=NumberMode.BOX,
        value_fn=_hold_alt_static_value,
        set_fn=lambda coord, v: coord.async_set_hold(
            {"alternate": {"static": int(v * 1000)}}
        ),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up KineticBoard number entities from a config entry."""
    coordinator: KineticBoardCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities(
        KineticBoardNumber(coordinator, entry, description)
        for description in ENTITY_DESCRIPTIONS
    )


class KineticBoardNumber(CoordinatorEntity[KineticBoardCoordinator], NumberEntity):
    """A number entity for a KineticBoard setting."""

    _attr_has_entity_name = True
    entity_description: KineticBoardNumberDescription

    def __init__(
        self,
        coordinator: KineticBoardCoordinator,
        entry: ConfigEntry,
        description: KineticBoardNumberDescription,
    ) -> None:
        """Initialise the entity."""
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="KineticBoard",
            manufacturer=MANUFACTURER,
            model=MODEL,
        )

    @property
    def native_value(self) -> float | None:
        """Return the current value."""
        if self.coordinator.data is None:
            return None
        return self.entity_description.value_fn(self.coordinator.data)

    async def async_set_native_value(self, value: float) -> None:
        """Handle a value change."""
        await self.entity_description.set_fn(self.coordinator, value)
