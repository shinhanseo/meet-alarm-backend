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

router.get("/map-pick", async(req, res) => {
  try{
    const { lat, lng } = req.query;

    const latNum = Number(lat);
    const lngNum = Number(lng);

    const kakaoRes = await axios.get(
      "https://dapi.kakao.com/v2/local/geo/coord2address.json",
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        },
        params: {
          x: lng,
          y: lat,
        },
        timeout: 5000,
      }
    )

    const doc = kakaoRes.data?.documents?.[0];
    if(!doc){
      return res.status(404).json({message : "주소 결과가 없습니다."});
    }

    const road = doc.road_address?.address_name;
    const jibun = doc.address?.address_name;
    const address = road || jibun || "";
    const buildingName = doc.road_address?.building_name;

    const name =  doc.road_address?.road_name ||
                  doc.address?.region_3depth_name ||
                  (address ? address.split(" ").slice(-2).join(" ") : "선택한 위치");

    return res.json({
      place: {
        name,
        address,
        buildingName,
        lat: latNum,
        lng: lngNum,
      },
    });

  }catch(err : any){
    return res.status(500).json({
      message: "reverse-geocode 실패",
      detail: err?.response?.data || String(err),
    });
  }
})
export default router;
