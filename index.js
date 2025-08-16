import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3000
const ELEVEN_KEY = process.env.ELEVEN_KEY
const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'

app.post('/stream', async (req, res) => {
  const { text } = req.body
  const CHUNK_SIZE = 1024

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.3,
          similarity_boost: 0.7
        }
      })
    })

    if (!response.ok || !response.body) {
      return res.status(500).send('Error streaming audio from ElevenLabs')
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Transfer-Encoding', 'chunked')

    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }

    res.end()
  } catch (err) {
    res.status(500).send('Internal Server Error')
  }
})

app.listen(PORT, () => {
  console.log(`✅ ElevenLabs streaming server running on port ${PORT}`)
})
