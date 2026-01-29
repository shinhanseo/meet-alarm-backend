import { Router } from "express";
import axios from "axios";
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
    return res.status(400).json({ message: "db error" });
  }
})

export default router;