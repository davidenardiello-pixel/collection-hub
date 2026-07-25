import { DEFAULT_PROPERTY_CITY, PROPERTY_CITIES } from "./constants";
import type { Property, PropertyCityId } from "./types";

export function normalizePropertyCity(
  value: PropertyCityId | string | undefined,
): PropertyCityId {
  if (
    value &&
    PROPERTY_CITIES.some((city) => city.id === value)
  ) {
    return value as PropertyCityId;
  }

  return DEFAULT_PROPERTY_CITY;
}

export function getPropertyCityLabel(cityId: PropertyCityId): string {
  return (
    PROPERTY_CITIES.find((city) => city.id === cityId)?.label ?? cityId
  );
}

export function getPropertyCity(
  propertyId: string,
  properties: Property[],
): PropertyCityId {
  const property = properties.find((item) => item.id === propertyId);
  return normalizePropertyCity(property?.city);
}

export function filterPropertiesByCity(
  properties: Property[],
  cityId: PropertyCityId | "all",
): Property[] {
  if (cityId === "all") {
    return properties;
  }

  return properties.filter(
    (property) => normalizePropertyCity(property.city) === cityId,
  );
}

export function formatPropertyOptionLabel(property: Property): string {
  const cityLabel = getPropertyCityLabel(normalizePropertyCity(property.city));
  return `${property.name} (${cityLabel})`;
}

export function groupPropertiesByCity(properties: Property[]) {
  return PROPERTY_CITIES.map((city) => ({
    ...city,
    properties: properties.filter(
      (property) => normalizePropertyCity(property.city) === city.id,
    ),
  })).filter((group) => group.properties.length > 0);
}
