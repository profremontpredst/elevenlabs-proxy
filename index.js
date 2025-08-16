import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const ELEVEN_KEY = process.env.ELEVEN_KEY;
const VOICE_ID   = process.env.ELEVEN_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL_ID   = process.env.ELEVEN_MODEL_ID || "eleven_flash_v2_5";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.disable("x-powered-by");

app.get("/", (_req, res) => res.send("✅ ElevenLabs Proxy running"));

app.post("/say", async (req, res) => {
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  const text = (req.body?.text ?? "").toString().trim();
  if (!text) return res.status(400).send("No text provided");

  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?optimize_streaming_latency=3&output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    if (!upstream.ok || !upstream.body) {
      const err = await upstream.text().catch(() => "");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(upstream.status || 502).send(err || JSON.stringify({ error: "TTS upstream failed" }));
    }

    // Прямой стрим в ответ, как в старой версии
    upstream.body.pipe(res);
  } catch (e) {
    if (!res.headersSent) res.status(502).send("Proxy error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 ElevenLabs proxy on:", PORT));
