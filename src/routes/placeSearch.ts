import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ message: "q is required" });

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return res.status(500).json({ message: "KAKAO_REST_API_KEY missing" });

  const headers = { Authorization: `KakaoAK ${apiKey}` };

  try {
    const [kw, addr] = await Promise.all([
      axios.get("https://dapi.kakao.com/v2/local/search/keyword.json", {
        headers,
        params: { query: q, size: 15 },
        timeout: 5000,
      }),
      axios.get("https://dapi.kakao.com/v2/local/search/address.json", {
        headers,
        params: { query: q, size: 15 },
        timeout: 5000,
      }),
    ]);

    const kwPlaces = (kw.data.documents || []).map((d: any) => ({
      name: d.place_name,
      address: d.road_address_name || d.address_name || "",
      lat: Number(d.y),
      lng: Number(d.x),
      source: "keyword",
    }));

    const addrPlaces = (addr.data.documents || []).map((d: any) => ({
      name: d.address_name,
      address: d.road_address?.address_name || d.address_name || "",
      lat: Number(d.y),
      lng: Number(d.x),
      source: "address",
    }));

    // 중복 제거(좌표 기준 간단히)
    const seen = new Set<string>();
    const merged = [...kwPlaces, ...addrPlaces].filter((p) => {
      const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json({ places: merged });
  } catch (err: any) {
    res.status(502).json({ message: "kakao api error", status: err?.response?.status, detail: err?.response?.data });
  }
});


export default router;
