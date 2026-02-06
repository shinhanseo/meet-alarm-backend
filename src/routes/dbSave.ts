import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

type Place = { name: string; address: string; lat: number; lng: number };
type Body = {
  installId: string;
  title: string;
  meetingAt: string;
  originPlace: Place;
  destPlace: Place;
};

export async function apiLogCall(params: {
  installId: string,
  apiName: string,
  statusCode: number;
}) {
  const { installId, apiName, statusCode } = params;

  try {
    await pool.query(
      `
        INSERT INTO api_requests ( install_id, api_name, status_code )
        VALUES ($1, $2, $3);
      `, [
      installId,
      apiName,
      statusCode,
    ]
    )
  } catch (err) {
    console.log("api 저장 실패", err);
  }
}


router.post("/install", async (req, res) => {
  const { installId, platform, osVersion, deviceModel } = req.body ?? {};

  if (!installId || !platform) {
    return res.status(400).json({ message: "installId and platform required" });
  }

  try {
    await pool.query(
      `
      INSERT INTO installs (install_id, platform, os_version, device_model)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (install_id)
      DO UPDATE SET
        platform = EXCLUDED.platform,
        os_version = EXCLUDED.os_version,
        device_model = EXCLUDED.device_model,
        last_seen_at = NOW();
      `,
      [installId, platform, osVersion ?? null, deviceModel ?? null]
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "db error" });
  }
});

router.post("/meeting", async (req, res) => {
  const { installId, title, meetingAt, originPlace, destPlace }: Body = req.body;

  if (!installId || !title || !meetingAt || !originPlace || !destPlace) {
    return res.status(400).json({ message: "필수 요소가 빠졌습니다." });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO appointments (
          install_id, title, meeting_at, 
          origin_name, origin_address, origin_lat, origin_lng, 
          dest_name, dest_address, dest_lat, dest_lng)
        VALUES (
          $1, $2, $3, 
          $4, $5, $6, $7, 
          $8, $9, $10, $11 )
        RETURNING id;
      `,
      [
        installId,
        title,
        meetingAt,
        originPlace.name,
        originPlace.address,
        originPlace.lat,
        originPlace.lng,
        destPlace.name,
        destPlace.address,
        destPlace.lat,
        destPlace.lng
      ]
    );

    return res.status(201).json({ id: result.rows[0].id });

  } catch (e) {
    console.log(e);
    return res.status(400).json({ message: "약속 저장 오류" });
  }
});

router.put("/meeting/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title, meetingAt, originPlace, destPlace } = req.body;

  if (!title || !meetingAt || !originPlace || !destPlace) {
    return res.status(400).json({ message: "필수 요소가 빠졌습니다." });
  }

  try {
    const result = await pool.query(
      `
        UPDATE appointments 
        SET 
          title = $1,
          meeting_at = $2,
          origin_name = $3,
          origin_address = $4,
          origin_lat = $5,
          origin_lng = $6,
          dest_name = $7,
          dest_address = $8,
          dest_lat = $9,
          dest_lng = $10
        WHERE id = $11
      `,
      [
        title,
        meetingAt,
        originPlace.name,
        originPlace.address,
        originPlace.lat,
        originPlace.lng,
        destPlace.name,
        destPlace.address,
        destPlace.lat,
        destPlace.lng,
        id
      ]
    );

    return res.status(200).json({ message: "업데이트 성공" });
  } catch (e) {
    console.log("약속 업데이트 실패", e);
    res.status(400).json({ message: "약속 업데이트 오류" });
  }
});

router.delete("/meeting/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const result = pool.query(
      `
        DELETE FROM appointments
        WHERE id = $1;
      `,
      [
        id
      ]
    );

    res.status(200).json({ message: "삭제 성공" });
  } catch (e) {
    console.log("삭제 실패", e);
    res.status(400).json({ message: "삭제 실패" });
  }
});

export default router;