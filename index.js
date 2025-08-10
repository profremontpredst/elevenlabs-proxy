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
app.use(express.json());

app.post("/stream", async (req, res) => {
  const { text } = req.body || {};
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  if (!text || !String(text).trim()) return res.status(400).send("No text provided");

  try {
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;
    const elevenRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text: String(text).slice(0, 500),        // на всякий — чтобы не рвало длинняк
        model_id: MODEL_ID,
        optimize_streaming_latency: 2,           // быстрее старт
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    if (!elevenRes.ok || !elevenRes.body) {
      const errTxt = await elevenRes.text().catch(() => "");
      return res.status(502).send(errTxt || "ElevenLabs TTS failed");
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    // НЕ ставим Transfer-Encoding: chunked — пусть Node сам решает
    elevenRes.body.pipe(res);
  } catch (err) {
    console.error("❌ ElevenLabs Error:", err);
    if (!res.headersSent) res.status(500).send("Error from ElevenLabs");
  }
});

app.get("/", (_req, res) => {
  res.send("✅ ElevenLabs Flash Proxy running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Flash HTTP Proxy listening on port", PORT);
});
