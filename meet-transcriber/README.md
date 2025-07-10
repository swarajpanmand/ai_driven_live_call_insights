# Meet Transcriber Server

A real-time audio transcription server for Google Meet calls with WebSocket support and Picture-in-Picture (PiP) window functionality.

## Features

- Real-time audio transcription using Hugging Face Whisper API
- WebSocket streaming for live transcription updates
- Speaker detection (You vs Other Person)
- Picture-in-Picture window for floating transcription display
- Fallback transcription when API quota is exceeded
- Support for multiple audio sources (Meet, Microphone, or both)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your Hugging Face API token in `server.js`:
```javascript
const HUGGING_FACE_TOKEN = "your_token_here";
```

3. Start the server:
```bash
node server.js
```

The server will run on `http://localhost:5000`

## API Quota Issues

If you encounter a 402 error (quota exceeded), the system will:

1. **Show helpful error messages** with solutions
2. **Use fallback transcriptions** to keep the system functional
3. **Display warnings** instead of blocking the entire system

### Solutions for API Quota Issues:

1. **Upgrade to Hugging Face PRO** - Get 20x more monthly credits
2. **Wait for next billing cycle** - Credits reset monthly
3. **Use existing transcriptions** - The PiP window still works with previous transcriptions
4. **Try again later** - When credits reset

### Fallback Mode

When the API quota is exceeded, the system automatically switches to fallback mode:
- Generates sample transcriptions based on audio source
- Maintains the same UI and PiP functionality
- Shows warning messages to inform users
- Allows testing of the transcription flow

## API Endpoints

- `GET /health` - Health check
- `POST /transcribe` - Single audio file transcription
- `POST /transcribe-stream` - Real-time streaming transcription
- WebSocket connection for live updates

## WebSocket Messages

### From Client to Server:
- `start_streaming` - Start real-time transcription
- `stop_streaming` - Stop real-time transcription
- `audio_chunk` - Send audio data for processing

### From Server to Client:
- `transcription` - New transcription result
- `error` - Error message
- `warning` - Warning message
- `streaming_started` - Streaming started confirmation
- `streaming_stopped` - Streaming stopped confirmation

## PiP Window

The Picture-in-Picture window provides:
- Floating, always-on-top display
- Real-time transcription updates
- Speaker labels and timestamps
- Manual controls (test, clear, close)
- Draggable interface

## Troubleshooting

### Common Issues:

1. **Port 5000 already in use**:
   ```bash
   pkill -f "node server.js"
   node server.js
   ```

2. **WebSocket connection issues**:
   - Check if server is running
   - Verify CORS settings
   - Check browser console for errors

3. **API quota exceeded**:
   - System will use fallback mode
   - Upgrade to Hugging Face PRO
   - Wait for next billing cycle

4. **Audio not capturing**:
   - Ensure microphone permissions
   - Check browser audio settings
   - Verify audio source selection

## Development

To enable fallback mode for testing:
```bash
USE_FALLBACK=true node server.js
```

This will use mock transcriptions instead of calling the API. 