import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

app.post('/stream', async (req, res) => {
  try {
    const { text } = req.body;

    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL/stream', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVEN_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8
        }
      })
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send('error');
  }
});

app.listen(3000, () => {
  console.log('server started on port 3000');
});
