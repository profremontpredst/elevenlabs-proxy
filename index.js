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

// --- очистка текста: сохраняем эмоции, выкидываем смайлы/формы/HTML ---
function cleanText(inputRaw = "") {
  let s = String(inputRaw)
    .normalize("NFKC")
    // убираем квадратные служебные теги вида [openLeadForm], [showCatalog] и т.п.
    .replace(/\[(?:openLeadForm|showCatalog|showCombo|confirmPay|showLoading|showThanks|reset)\]/gi, " ")
    // выкинуть любые «другие» квадратные инструкции, если прилетят
    .replace(/\[[^\]]{1,50}\]/g, " ")
    // убрать HTML
    .replace(/<[^>]*>/g, " ")
    // удалить управляющие и невидимые символы (кроме базовых пробелов/переводов строк)
    .replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F]/g, " ")
    // убрать эмодзи (основные блоки)
    .replace(/[\u{1F000}-\u{1FAFF}]/gu, " ")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, " ")
    .replace(/[\u{1F600}-\u{1F64F}]/gu, " ")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, " ")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, " ")
    .replace(/[\u{2600}-\u{27BF}]/gu, " ") // разное/символы
    // сжать повторы пробелов и пунктуации
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*([!?…]+)\s*/g, "$1 ")
    .replace(/\s*([,.:-])\s*/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // если после чистки пусто — пусть хоть что-то скажет
  if (!s) s = "Хорошо.";
  // не режем по длине — ElevenLabs сам справится, но можно убрать совсем длинные хвосты мусора
  return s;
}

app.get("/", (_req, res) => res.send("✅ ElevenLabs Proxy running"));

/** Совместимость: старый путь */
app.post("/stream", async (req, res) => {
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  const text = cleanText(req.body?.text ?? "");
  if (!text) return res.status(400).send("No text provided");
  await proxyTTS(text, res);
});

/** Рекомендуемый путь для виджета: POST /say { text } */
app.post("/say", async (req, res) => {
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  const text = cleanText(req.body?.text ?? "");
  if (!text) return res.status(400).send("No text provided");
  await proxyTTS(text, res);
});

/** (опционально) GET /say?text=... — для ручной проверки в браузере */
app.get("/say", async (req, res) => {
  if (!ELEVEN_KEY) return res.status(500).send("No ELEVEN_KEY");
  const text = cleanText(req.query?.text ?? "");
  if (!text) return res.status(400).send("No text provided");
  await proxyTTS(text, res);
});

async function proxyTTS(text, res) {
  // готовим заголовки как аудио; pipe сам проставит chunked
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

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
        text, // уже очищенный
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    if (!upstream.ok || !upstream.body) {
      const errTxt = await upstream.text().catch(() => "");
      try { res.setHeader("Content-Type", "application/json; charset=utf-8"); } catch {}
      return res.status(upstream.status || 502).send(errTxt || JSON.stringify({ error: "TTS upstream failed" }));
    }

    // прямой стрим — как в «рабочем старом»
    upstream.body.pipe(res);

    // страховка на ошибке апстрима
    upstream.body.on?.("error", (e) => {
      console.error("upstream error:", e?.message || e);
      try { res.end(); } catch {}
    });

    // если клиент закрылся — закрываем апстрим
    res.on("close", () => {
      try { upstream.body.cancel?.(); } catch {}
    });
  } catch (e) {
    console.error("proxy error:", e?.message || e);
    if (!res.headersSent) res.status(502).send("Proxy error");
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 ElevenLabs proxy on:", PORT));
