import { Router } from "express";
import axios from "axios";

const router = Router();

type LatLon = { lat: number; lon: number };

type WeatherDto = {
  coord: LatLon;
  name: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  main: string;
  description: string;
  icon: string;
  dt: number;
};

function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function isValidLatLon(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function buildWeatherDto(data: any): WeatherDto {
  return {
    coord: { lat: data?.coord?.lat ?? 0, lon: data?.coord?.lon ?? 0 },
    name: data?.name ?? "",
    temp: data?.main?.temp ?? 0,
    feelsLike: data?.main?.feels_like ?? 0,
    humidity: data?.main?.humidity ?? 0,
    windSpeed: data?.wind?.speed ?? 0,
    main: data?.weather?.[0]?.main ?? "",
    description: data?.weather?.[0]?.description ?? "",
    icon: data?.weather?.[0]?.icon ?? "",
    dt: data?.dt ?? 0,
  };
}

router.get("/", async (req, res) => {
  try {
    const lat = toNumber(req.query.lat);
    const lon = toNumber(req.query.lon);

    if (!isValidLatLon(lat, lon)) {
      return res.status(400).json({
        message: "lat/lon이 올바르지 않습니다",
        example: "/api/weather?lat=37.5665&lon=126.9780",
      });
    }

    const apiKey = process.env.OPENWEATHER_API_KEY!;
    const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
      params: { lat, lon, appid: apiKey, units: "metric", lang: "kr" },
      timeout: 8000,
    });

    return res.json({
      weather: buildWeatherDto(response.data),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "날씨 API 호출 실패" });
  }
});

export default router;
