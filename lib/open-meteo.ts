const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export type AirportWeather = {
  timezone?: string;
  timezoneAbbreviation?: string;
  current?: {
    time?: string;
    temperature2m?: number;
    apparentTemperature?: number;
    weatherCode?: number;
    windSpeed10m?: number;
    isDay?: number;
  };
  daily?: {
    time?: string[];
    weatherCode?: number[];
    temperature2mMax?: number[];
    temperature2mMin?: number[];
  };
};

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const numbers = value.map((item) => toNumber(item)).filter((item): item is number => item !== undefined);
  return numbers.length === value.length ? numbers : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : undefined;
}

function normaliseWeather(raw: unknown): AirportWeather | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const current = record.current && typeof record.current === 'object' && !Array.isArray(record.current)
    ? record.current as Record<string, unknown>
    : null;
  const daily = record.daily && typeof record.daily === 'object' && !Array.isArray(record.daily)
    ? record.daily as Record<string, unknown>
    : null;

  return {
    timezone: typeof record.timezone === 'string' ? record.timezone : undefined,
    timezoneAbbreviation:
      typeof record.timezone_abbreviation === 'string' ? record.timezone_abbreviation : undefined,
    current: current
      ? {
          time: typeof current.time === 'string' ? current.time : undefined,
          temperature2m: toNumber(current.temperature_2m),
          apparentTemperature: toNumber(current.apparent_temperature),
          weatherCode: toNumber(current.weather_code),
          windSpeed10m: toNumber(current.wind_speed_10m),
          isDay: toNumber(current.is_day),
        }
      : undefined,
    daily: daily
      ? {
          time: toStringArray(daily.time),
          weatherCode: toNumberArray(daily.weather_code),
          temperature2mMax: toNumberArray(daily.temperature_2m_max),
          temperature2mMin: toNumberArray(daily.temperature_2m_min),
        }
      : undefined,
  };
}

export async function getAirportWeather(args: { latitude?: number; longitude?: number }) {
  if (typeof args.latitude !== 'number' || typeof args.longitude !== 'number') return null;

  const url = new URL(OPEN_METEO_URL);
  url.searchParams.set('latitude', String(args.latitude));
  url.searchParams.set('longitude', String(args.longitude));
  url.searchParams.set(
    'current',
    ['temperature_2m', 'apparent_temperature', 'weather_code', 'wind_speed_10m', 'is_day'].join(','),
  );
  url.searchParams.set('daily', ['weather_code', 'temperature_2m_max', 'temperature_2m_min'].join(','));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '2');
  url.searchParams.set('temperature_unit', 'celsius');
  url.searchParams.set('wind_speed_unit', 'kmh');

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 60 * 30 },
    });
    if (!res.ok) return null;
    return normaliseWeather(await res.json());
  } catch {
    return null;
  }
}

export function weatherLabel(code?: number): string {
  if (code === undefined) return 'Weather unavailable';
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return ['Mainly clear', 'Partly cloudy', 'Overcast'][code - 1];
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55].includes(code)) return 'Drizzle';
  if ([56, 57].includes(code)) return 'Freezing drizzle';
  if ([61, 63, 65].includes(code)) return 'Rain';
  if ([66, 67].includes(code)) return 'Freezing rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([85, 86].includes(code)) return 'Snow showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Local conditions';
}
