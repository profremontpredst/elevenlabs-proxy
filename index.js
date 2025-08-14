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

// health
app.get("/", (_req, res) => res.send("✅ ElevenLabs Proxy running"));

app.post("/stream", async (req, res) => {
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");

  const { text } = req.body || {};
  const clean = (text ?? "").toString().replace(/\s+/g, " ").trim();
  if (!clean) return res.status(400).send("No text provided");

  try {
    // Готовим заголовки сразу — это поток
    req.setTimeout(0);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    const url =
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream` +
      `?optimize_streaming_latency=3&output_format=mp3_44100_128`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text: clean,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    if (!upstream.ok || !upstream.body) {
      const errTxt = await upstream.text().catch(() => "");
      console.error("Upstream TTS error:", upstream.status, errTxt.slice(0, 500));
      return res.status(502).send(errTxt || `TTS upstream ${upstream.status}`);
    }

    // === Поток: работаем на любой версии Node ===
    const body = upstream.body;

    // Если доступен WebStream reader — пишем чанки вручную
    if (typeof body.getReader === "function") {
      const reader = body.getReader();

      // Если клиент закрыл соединение — прерываем чтение
      let aborted = false;
      const abort = async () => { try { aborted = true; await reader.cancel(); } catch {} };
      req.on("aborted", abort);
      req.on("close", abort);

      try {
        // Читаем и шлём чанки, пока не закончится поток
        // (так работает даже на Node 16)
        while (true) {
          const { value, done } = await reader.read();
          if (done || aborted) break;
          if (value && value.byteLength) res.write(Buffer.from(value));
        }
      } catch (e) {
        console.error("Stream read error:", e?.message || e);
      } finally {
        res.end();
      }
      return;
    }

    // Fallback: если это уже Node-стрим (редко в v2 fetch)
    if (typeof body.pipe === "function") {
      body.pipe(res);
      body.on("error", (e) => {
        console.error("Pipe error:", e?.message || e);
        try { res.end(); } catch {}
      });
      return;
    }

    // Совсем крайний случай — буферизация (почти не встречается)
    const buf = await upstream.arrayBuffer();
    res.end(Buffer.from(buf));

  } catch (err) {
    console.error("❌ Proxy crash:", err?.message || err);
    if (!res.headersSent) res.status(500).send("Proxy error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 ElevenLabs proxy on :", PORT));
