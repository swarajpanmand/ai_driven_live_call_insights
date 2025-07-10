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

// Fallback transcription function for when API quota is exceeded
function generateFallbackTranscription(audioSource) {
  const fallbackTexts = {
    microphone: [
      "Hello, this is a test transcription from your microphone.",
      "I'm speaking into the microphone for testing purposes.",
      "This is a fallback transcription when the API is not available."
    ],
    meet: [
      "Welcome to the meeting, everyone.",
      "Thank you for joining us today.",
      "Let's discuss the agenda for this call."
    ],
    both: [
      "Hello everyone, welcome to our meeting.",
      "I can hear both the meeting audio and my microphone.",
      "This is a combined audio transcription test."
    ]
  };
  
  const texts = fallbackTexts[audioSource] || fallbackTexts.both;
  const randomText = texts[Math.floor(Math.random() * texts.length)];
  
  return {
    text: randomText,
    confidence: 0.85,
    speaker: audioSource === 'microphone' ? 'You' : 'Other Person'
  };
}

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
  
  // Store audio chunks for this connection
  ws.audioChunks = [];
  ws.isStreaming = false;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'start_streaming') {
        console.log('🎙 Starting audio streaming for client');
        ws.isStreaming = true;
        ws.audioChunks = [];
        ws.send(JSON.stringify({ type: 'streaming_started' }));
      }
      
      if (data.type === 'stop_streaming') {
        console.log('⏹ Stopping audio streaming for client');
        ws.isStreaming = false;
        ws.send(JSON.stringify({ type: 'streaming_stopped' }));
      }
      
      if (data.type === 'audio_chunk' && ws.isStreaming) {
        // Process audio chunk immediately
        await processAudioChunk(ws, data.audio, data.audioSource);
      }
      
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    ws.isStreaming = false;
    ws.audioChunks = [];
  });
});

// Process audio chunk with streaming
async function processAudioChunk(ws, audioData, audioSource) {
  try {
    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    if (audioBuffer.length < 1000) {
      console.log('⚠️ Audio chunk too small, skipping');
      return;
    }
    
    console.log('📁 Processing streaming audio chunk:', audioBuffer.length, 'bytes');
    
    // Create a proper WAV file buffer for Hugging Face API
    // The audio data from the frontend is already in WAV format as base64
    // We just need to ensure it's properly formatted for the API
    
    // Replace with your actual Hugging Face token
    const HUGGING_FACE_TOKEN = "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";
    
    const response = await fetch('https://api-inference.huggingface.co/models/openai/whisper-large-v3', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HUGGING_FACE_TOKEN}`,
        'Content-Type': 'audio/wav'
      },
      body: audioBuffer
    });
    
    console.log('📡 API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      console.error('❌ Audio buffer size:', audioBuffer.length);
      
      // Handle specific error cases
      if (response.status === 402) {
        console.error('❌ Hugging Face API quota exceeded. Using fallback transcription.');
        
        // Use fallback transcription instead of failing
        const fallbackResult = generateFallbackTranscription(audioSource);
        
        ws.send(JSON.stringify({
          type: 'transcription',
          text: fallbackResult.text,
          speaker: fallbackResult.speaker,
          timestamp: new Date().toISOString(),
          confidence: fallbackResult.confidence,
          audioSource: audioSource,
          isFallback: true
        }));
        
        // Also send a warning message
        ws.send(JSON.stringify({
          type: 'warning',
          message: 'Using fallback transcription due to API quota limit. Upgrade to PRO for real transcriptions.',
          errorCode: 'QUOTA_EXCEEDED'
        }));
      } else if (response.status === 429) {
        console.error('❌ Rate limit exceeded. Please wait before trying again.');
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Rate limit exceeded. Please wait before trying again.',
          errorCode: 'RATE_LIMIT'
        }));
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          message: `API Error: ${errorText}`,
          errorCode: 'API_ERROR'
        }));
      }
      return;
    }
    
    const result = await response.json();
    console.log('📝 Streaming transcription result:', result);
    
    // Process transcription with speaker detection
    let speaker = 'Unknown';
    
    if (result.text) {
      // Ensure the transcription is in English
      const englishText = result.text.trim();
      
      // Skip if the text is empty or contains non-English characters
      if (!englishText || /[^\x00-\x7F]/.test(englishText)) {
        console.log('⚠️ Skipping non-English or empty transcription:', englishText);
        return;
      }
      // Determine speaker based on audio source
      if (audioSource === 'microphone') {
        speaker = 'You';
      } else if (audioSource === 'meet') {
        speaker = 'Other Person';
      } else if (audioSource === 'both') {
        // For combined audio, use more sophisticated detection
        const words = result.text.toLowerCase().split(' ');
        const hasQuestionWords = words.some(word => ['what', 'how', 'why', 'when', 'where', 'who', '?'].includes(word));
        const hasGreetings = words.some(word => ['hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening'].includes(word));
        const hasMeetingWords = words.some(word => ['meeting', 'call', 'presentation', 'slide', 'share', 'screen'].includes(word));
        
        if (hasQuestionWords || hasGreetings || hasMeetingWords) {
          speaker = 'Other Person';
        } else {
          const hasPersonalPronouns = words.some(word => ['i', 'me', 'my', 'mine', 'myself'].includes(word));
          const hasCasualLanguage = words.some(word => ['um', 'uh', 'like', 'you know', 'basically'].includes(word));
          
          if (hasPersonalPronouns || hasCasualLanguage) {
            speaker = 'You';
          } else {
            speaker = 'Other Person';
          }
        }
      }
      
      // Send transcription back to the specific client
      ws.send(JSON.stringify({
        type: 'transcription',
        text: englishText,
        speaker: speaker,
        timestamp: new Date().toISOString(),
        confidence: result.confidence || 0,
        audioSource: audioSource
      }));
    }
    
  } catch (error) {
    console.error('❌ Audio chunk processing error:', error);
  }
}

// Broadcast to all connected clients
function broadcastToClients(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Handle real-time audio transcription with speaker detection
app.post('/transcribe-stream', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('📁 Received streaming audio file:', req.file.size, 'bytes');

    // Replace with your actual Hugging Face token
    const HUGGING_FACE_TOKEN = "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";

    console.log('🤖 Sending to Hugging Face API for real-time transcription with speaker detection...');

    // Use Whisper model with speaker diarization
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
      
      // Handle specific error cases
      if (response.status === 402) {
        console.error('❌ Hugging Face API quota exceeded. Please upgrade to PRO or wait for next billing cycle.');
        return res.status(402).json({ 
          error: 'API quota exceeded. Please upgrade to Hugging Face PRO or wait for next billing cycle.',
          errorCode: 'QUOTA_EXCEEDED',
          details: 'You have exceeded your monthly included credits for Inference Providers. Subscribe to PRO to get 20x more monthly included credits.'
        });
      } else if (response.status === 429) {
        console.error('❌ Rate limit exceeded. Please wait before trying again.');
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Please wait before trying again.',
          errorCode: 'RATE_LIMIT'
        });
      } else {
        return res.status(response.status).json({ 
          error: errorText,
          errorCode: 'API_ERROR'
        });
      }
    }

    const result = await response.json();
    console.log('📝 Real-time transcription result:', result);

    // Process transcription with speaker detection based on audio source
    let processedText = result.text;
    let speaker = 'Unknown';
    const audioSource = req.body.audioSource || 'meet';
    
    if (result.text) {
      // Determine speaker based on audio source
      if (audioSource === 'microphone') {
        speaker = 'You';
      } else if (audioSource === 'meet') {
        speaker = 'Other Person';
      } else if (audioSource === 'both') {
        // For combined audio, use more sophisticated detection
        const words = result.text.toLowerCase().split(' ');
        const hasQuestionWords = words.some(word => ['what', 'how', 'why', 'when', 'where', 'who', '?'].includes(word));
        const hasGreetings = words.some(word => ['hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening'].includes(word));
        const hasMeetingWords = words.some(word => ['meeting', 'call', 'presentation', 'slide', 'share', 'screen'].includes(word));
        
        // More sophisticated speaker detection for combined audio
        if (hasQuestionWords || hasGreetings || hasMeetingWords) {
          speaker = 'Other Person';
        } else {
          // Check for personal pronouns and casual language
          const hasPersonalPronouns = words.some(word => ['i', 'me', 'my', 'mine', 'myself'].includes(word));
          const hasCasualLanguage = words.some(word => ['um', 'uh', 'like', 'you know', 'basically'].includes(word));
          
          if (hasPersonalPronouns || hasCasualLanguage) {
            speaker = 'You';
          } else {
            speaker = 'Other Person';
          }
        }
      }
    }

    // Broadcast the transcription with speaker info to all connected clients
    if (result.text) {
      broadcastToClients({
        type: 'transcription',
        text: result.text,
        speaker: speaker,
        timestamp: new Date().toISOString(),
        confidence: result.confidence || 0,
        audioSource: audioSource
      });
    }

    res.json({
      ...result,
      speaker: speaker,
      audioSource: req.body.audioSource || 'meet'
    });
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
      
      // Handle specific error cases
      if (response.status === 402) {
        console.error('❌ Hugging Face API quota exceeded. Please upgrade to PRO or wait for next billing cycle.');
        return res.status(402).json({ 
          error: 'API quota exceeded. Please upgrade to Hugging Face PRO or wait for next billing cycle.',
          errorCode: 'QUOTA_EXCEEDED',
          details: 'You have exceeded your monthly included credits for Inference Providers. Subscribe to PRO to get 20x more monthly included credits.'
        });
      } else if (response.status === 429) {
        console.error('❌ Rate limit exceeded. Please wait before trying again.');
        return res.status(429).json({ 
          error: 'Rate limit exceeded. Please wait before trying again.',
          errorCode: 'RATE_LIMIT'
        });
      } else {
        return res.status(response.status).json({ 
          error: errorText,
          errorCode: 'API_ERROR'
        });
      }
    }

    const result = await response.json();
    console.log('📝 Transcription result:', result);

    // Ensure the transcription is in English
    if (result.text) {
      const englishText = result.text.trim();
      
      // Skip if the text is empty or contains non-English characters
      if (!englishText || /[^\x00-\x7F]/.test(englishText)) {
        console.log('⚠️ Skipping non-English or empty transcription:', englishText);
        return res.json({ text: '', error: 'Non-English content detected' });
      }
      
      result.text = englishText;
    }

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