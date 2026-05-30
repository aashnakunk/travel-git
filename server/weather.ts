// Weather via Open-Meteo (free, no API key). Geocode a place name, then fetch
// the daily forecast. Forecasts are reliable ~16 days out; beyond that we say
// so and let the model fall back to seasonal knowledge.

interface GeoResult {
  latitude: number
  longitude: number
  name: string
  country?: string
}

async function geocode(place: string): Promise<GeoResult | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      place,
    )}&count=1&language=en&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { results?: GeoResult[] }
    return data.results?.[0] ?? null
  } catch {
    return null
  }
}

export interface WeatherSummary {
  location: string
  date?: string
  forecast: string
}

export async function getWeather(place: string, date?: string): Promise<WeatherSummary> {
  const geo = await geocode(place)
  if (!geo) {
    return { location: place, date, forecast: `Could not locate "${place}" to fetch weather.` }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,snowfall_sum&forecast_days=16&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) {
      return { location: geo.name, date, forecast: 'Weather service unavailable right now.' }
    }
    const data = (await res.json()) as {
      daily?: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_sum: number[]
        snowfall_sum: number[]
      }
    }
    const daily = data.daily
    if (!daily) return { location: geo.name, date, forecast: 'No forecast data.' }

    // If a specific date is requested and within range, return that day.
    if (date) {
      const idx = daily.time.indexOf(date)
      if (idx >= 0) {
        const snow = daily.snowfall_sum[idx]
        return {
          location: geo.name,
          date,
          forecast: `On ${date} in ${geo.name}: high ${daily.temperature_2m_max[idx]}°C, low ${daily.temperature_2m_min[idx]}°C, precipitation ${daily.precipitation_sum[idx]}mm${
            snow > 0 ? `, snowfall ${snow}cm` : ''
          }.`,
        }
      }
      return {
        location: geo.name,
        date,
        forecast: `${date} is beyond the 16-day forecast window for ${geo.name}; use seasonal/historical expectations instead.`,
      }
    }

    // Otherwise summarize the next several days.
    const lines = daily.time.slice(0, 5).map((t, i) => {
      const snow = daily.snowfall_sum[i]
      return `${t}: ${daily.temperature_2m_min[i]}–${daily.temperature_2m_max[i]}°C, rain ${daily.precipitation_sum[i]}mm${
        snow > 0 ? `, snow ${snow}cm` : ''
      }`
    })
    return { location: geo.name, forecast: `Upcoming forecast for ${geo.name}:\n${lines.join('\n')}` }
  } catch {
    return { location: geo.name, date, forecast: 'Weather service error.' }
  }
}
