import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const ELEVEN_KEY = process.env.ELEVEN_KEY;
const VOICE_ID = "gedzfqL7OGdPbwm0ynTP"; // chelik
const MODEL_ID = "eleven_flash_v2_5";

const app = express();
app.use(cors());
app.use(express.json());
app.post("/tg-voice", async (req, res) => {
  const { text, emotion } = req.body;
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  if (!text) return res.status(400).send("No text provided");

  try {
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
    const elevenRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        },
        // эмоции пока просто для расширения
        emotion: emotion || "neutral"
      })
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("❌ ElevenLabs error:", errText);
      return res.status(502).send("Error from ElevenLabs");
    }

    const buf = Buffer.from(await elevenRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buf);
  } catch (err) {
    console.error("❌ ElevenLabs /tg-voice Error:", err);
    res.status(500).send("Error from ElevenLabs");
  }
});

app.post("/stream", async (req, res) => {
  const { text } = req.body;
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  if (!text) return res.status(400).send("No text provided");

  try {
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;
    const elevenRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");
    elevenRes.body.pipe(res);
  } catch (err) {
    console.error("❌ ElevenLabs Error:", err);
    res.status(500).send("Error from ElevenLabs");
  }
});

app.get("/", (req, res) => {
  res.send("✅ ElevenLabs Flash Proxy running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Flash HTTP Proxy listening on port", PORT);
});
