import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const ELEVEN_KEY = process.env.ELEVEN_KEY;
const VOICE_ID   = process.env.ELEVEN_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
const MODEL_ID   = process.env.ELEVEN_MODEL_ID || "eleven_multilingual_v2";

if (!ELEVEN_KEY) {
  console.error("❌ ELEVEN_KEY is missing. Check your .env or environment variables.");
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.disable("x-powered-by");

app.get("/", (_req, res) => res.send("✅ ElevenLabs TTS Proxy (MP3 REST)"));

app.post("/say", async (req, res) => {
  const text = (req.body?.text ?? "").toString().trim();
  if (!text) return res.status(400).send("No text provided");

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

  try {
    const response = await fetch(url, {
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

    console.log("🔁 Request to ElevenLabs:", text.slice(0, 40));

    if (!response.ok) {
      const error = await response.text().catch(() => "");
      console.error("❌ ElevenLabs TTS error:", response.status, error);
      return res.status(502).json({ error: "TTS failed", detail: error });
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(audioBuffer);
  } catch (err) {
    console.error("❌ TTS proxy error:", err);
    res.status(500).send("TTS proxy error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 ElevenLabs MP3 REST proxy running on port", PORT));
