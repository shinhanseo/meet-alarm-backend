import { Router } from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const photoVerdictSchema = z.object({
  isShoe: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    // 1) 파일 체크
    if (!req.file) {
      return res.status(400).json({ message: "image is required" });
    }

    const mimeType = req.file.mimetype;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return res.status(400).json({ message: "unsupported image type" });
    }

    const base64 = req.file.buffer.toString("base64");

    // 2) 프롬프트 
    const prompt = `
      You are a footwear detector.

      Decide if the image clearly shows real, physical footwear.

      Footwear = real shoes such as sneakers, boots, sandals, slippers.

      Return false if:
      - blurry, dark, small, or unclear
      - socks or bare feet
      - drawings or illustrations
      - images on screens or catalogs
      - toys or objects that only look similar

      If unsure, return false.

      Return JSON:
      {
        "isShoe": boolean,
        "confidence": 0~1,
        "reason": "short"
      }
      `;

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(photoVerdictSchema),
      },
    });

    const raw = result.text?.trim();
    if (!raw) {
      return res.status(502).json({ message: "제미나이 오류 발생" });
    }

    const parsed = photoVerdictSchema.parse(JSON.parse(raw));

    return res.json(parsed);
  } catch (err) {
    console.error("[/api/photo]", err);
    return res.status(500).json({ message: "사진 인증 실패패" });
  }
});

export default router;


