import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const ELEVEN_KEY = process.env.ELEVEN_KEY;
const VOICE_ID   = process.env.ELEVEN_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL_ID   = process.env.ELEVEN_MODEL_ID || "eleven_multilingual_v2";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.disable("x-powered-by");

app.get("/", (_req, res) => res.send("✅ ElevenLabs TTS Proxy"));

app.post("/say", async (req, res) => {
  const text = (req.body?.text ?? "").toString().trim();
  if (!text) return res.status(400).send("No text provided");

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?optimize_streaming_latency=3&output_format=mp3_44100_128`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.4, similarity_boost: 0.75 }
      })
    });

    if (!upstream.ok || !upstream.body) {
      const error = await upstream.text().catch(() => "");
      return res.status(502).json({ error: "TTS failed", detail: error });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Connection", "keep-alive");

    upstream.body.pipe(res);
  } catch (err) {
    res.status(500).send("TTS proxy error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 ElevenLabs TTS proxy running on port", PORT));
