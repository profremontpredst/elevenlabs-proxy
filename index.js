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
app.use(express.json({ limit: "2mb" }));
app.disable("x-powered-by");

app.get("/", (_req, res) => res.send("✅ ElevenLabs Proxy running"));

/** Мягкая очистка: убираем служебные теги/HTML/эмодзи, эмоции оставляем */
function cleanText(raw = "") {
  let s = String(raw)
    .normalize("NFKC")
    .replace(/\[(?:openLeadForm|showCatalog|showCombo|confirmPay|showLoading|showThanks|reset)\]/gi, " ")
    .replace(/\[[^\]]{1,50}\]/g, " ")           // любые короткие [теги]
    .replace(/<[^>]*>/g, " ")                   // HTML
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ") // управляющие
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ") // эмодзи/символы
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*([!?…]+)\s*/g, "$1 ")          // эмоции оставляем
    .replace(/\s*([,.:-])\s*/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!s) s = "Хорошо.";
  return s;
}

/** Рекомендуемый путь для фронта: возвращаем ГОТОВЫЙ MP3 целиком */
app.post("/say", async (req, res) => {
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  const text = cleanText(req.body?.text ?? "");
  if (!text) return res.status(400).send("No text provided");

  req.setTimeout(0); // длинные ответы не рвём

  const apiUrl =
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream` +
    `?optimize_streaming_latency=3&output_format=mp3_44100_128`;

  try {
    const upstream = await fetch(apiUrl, {
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

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => "");
      return res.status(upstream.status || 502)
        .type("application/json; charset=utf-8")
        .send(err || JSON.stringify({ error: "TTS upstream failed" }));
    }

    // ❗ Буферизуем до конца и отдаем целиком — без стриминга
    const arr = await upstream.arrayBuffer();
    const buf = Buffer.from(arr);

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(buf.length));
    return res.end(buf);
  } catch (e) {
    console.error("❌ ElevenLabs proxy error:", e?.message || e);
    if (!res.headersSent) return res.status(502).send("Proxy error");
  }
});

/** Совместимость: если где-то дергается старый путь — тоже буферизуем */
app.post("/stream", async (req, res) => {
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  const text = cleanText(req.body?.text ?? "");
  if (!text) return res.status(400).send("No text provided");

  req.setTimeout(0);

  const apiUrl =
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream` +
    `?optimize_streaming_latency=3&output_format=mp3_44100_128`;

  try {
    const upstream = await fetch(apiUrl, {
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

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => "");
      return res.status(upstream.status || 502)
        .type("application/json; charset=utf-8")
        .send(err || JSON.stringify({ error: "TTS upstream failed" }));
    }

    const arr = await upstream.arrayBuffer();
    const buf = Buffer.from(arr);

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(buf.length));
    return res.end(buf);
  } catch (e) {
    console.error("❌ ElevenLabs proxy /stream error:", e?.message || e);
    if (!res.headersSent) return res.status(502).send("Proxy error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 ElevenLabs proxy on:", PORT));
