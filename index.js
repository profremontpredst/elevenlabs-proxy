import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const ELEVEN_KEY = 'вставь_сюда_свой_ключ';

app.post('/stream', async (req, res) => {
  try {
    const { text } = req.body;

    const ttsRes = await fetch('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/stream', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8
        }
      })
    });

    if (!ttsRes.ok || !ttsRes.body) {
      console.error('TTS failed:', ttsRes.status);
      res.status(500).send('TTS failed');
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    ttsRes.body.on('error', (err) => {
      console.error('Stream error:', err);
      res.end();
    });
    ttsRes.body.pipe(res);
  } catch (e) {
    console.error('❌ ElevenLabs Error:', e);
    res.status(500).send('Internal server error');
  }
});

app.listen(3000, () => {
  console.log('server started on port 3000');
});
