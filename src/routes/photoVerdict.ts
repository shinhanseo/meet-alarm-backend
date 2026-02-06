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
      You are a simple image classifier.

      Task:
      Decide whether the image contains any real footwear.

      Definition of footwear:
      - Any real shoe, sneaker, boot, sandal, slipper, or similar item.
      - The footwear does NOT need to be worn.
      - The footwear may be on the floor, held by a hand, partially visible, or in the background.

      Rules:
      - If any real footwear is visible anywhere in the image, isShoe = true.
      - If no footwear is visible at all, isShoe = false.
      - Feet or socks alone are NOT footwear.
      - Illustrations, drawings, AI-generated images, or product catalog screenshots are NOT footwear.

      Return:
      - isShoe (boolean)
      - confidence (number between 0 and 1)
      - Optionally include a short reason or labels.

      `;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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
      return res.status(502).json({ message: "empty model response" });
    }

    const parsed = photoVerdictSchema.parse(JSON.parse(raw));

    return res.json(parsed);
  } catch (err) {
    console.error("[/api/photo]", err);
    return res.status(500).json({ message: "photo verdict failed" });
  }
});

export default router;


