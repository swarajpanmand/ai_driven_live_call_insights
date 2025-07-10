const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 5000;

// Enable CORS for frontend integration
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Serve static files
app.use(express.static('.'));

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection established');
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
  });
});

// Broadcast to all connected clients
function broadcastToClients(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Handle real-time audio transcription with intervals
app.post('/transcribe-stream', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('📁 Received streaming audio file:', req.file.size, 'bytes');

    // Replace with your actual Hugging Face token
    const HUGGING_FACE_TOKEN = "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";

    console.log('🤖 Sending to Hugging Face API for real-time transcription...');

    const response = await fetch('https://api-inference.huggingface.co/models/openai/whisper-large-v3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
        'Content-Type': 'audio/wav'
      },
      body: req.file.buffer
    });

    console.log('📡 API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const result = await response.json();
    console.log('📝 Real-time transcription result:', result);

    // Broadcast the transcription to all connected clients
    if (result.text) {
      broadcastToClients({
        type: 'transcription',
        text: result.text,
        timestamp: new Date().toISOString(),
        confidence: result.confidence || 0
      });
    }

    res.json(result);
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle audio transcription (original endpoint for backward compatibility)
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('📁 Received audio file:', req.file.size, 'bytes');

    // Replace with your actual Hugging Face token
    const HUGGING_FACE_TOKEN = "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";

    console.log('🤖 Sending to Hugging Face API...');

    const response = await fetch('https://api-inference.huggingface.co/models/openai/whisper-large-v3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
        'Content-Type': 'audio/wav'
      },
      body: req.file.buffer
    });

    console.log('📡 API Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const result = await response.json();
    console.log('📝 Transcription result:', result);

    res.json(result);
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'meet-transcriber', connections: wss.clients.size });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Meet Transcriber Server running at http://0.0.0.0:${port}`);
  console.log(`🔌 WebSocket server ready for real-time connections`);
}); 