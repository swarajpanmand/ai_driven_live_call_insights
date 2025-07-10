# Google Meet Audio Transcriber

A Node.js server that captures audio from Google Meet tabs and transcribes it using Hugging Face's Whisper model.

## Features

- 🎙️ **Tab Audio Capture**: Capture audio from any browser tab (including Google Meet)
- 🤖 **AI Transcription**: Uses Hugging Face's Whisper Large v3 model for accurate transcription
- 📱 **Modern UI**: Beautiful, responsive interface with real-time status updates
- 💾 **Download Results**: Save transcriptions as text files
- 🔄 **Real-time Processing**: 5-second recording cycles with immediate transcription

## Setup

### 1. Install Dependencies

```bash
cd meet-transcriber
npm install
```

### 2. Configure Hugging Face Token

Update the `HUGGING_FACE_TOKEN` in `server.js` with your own token:

```javascript
const HUGGING_FACE_TOKEN = "your_hugging_face_token_here";
```

To get a Hugging Face token:
1. Go to [Hugging Face](https://huggingface.co/)
2. Create an account or sign in
3. Go to Settings → Access Tokens
4. Create a new token

### 3. Start the Server

```bash
npm start
```

The server will run on `http://localhost:5000`

## Usage

### Standalone Mode

1. Open `http://localhost:5000` in your browser
2. Click "Start Recording"
3. Select the Google Meet tab when prompted
4. **Important**: Make sure to check "Share audio" when selecting the tab
5. The system will record for 5 seconds and transcribe the audio
6. View and download the transcription results

### Integrated Mode (with React Frontend)

The MeetTranscriber component is integrated into the main React app:

1. Start the main React app: `npm run dev` (in the frontend directory)
2. Navigate to the "Google Meet" tab in the interface
3. Use the integrated recording interface

## API Endpoints

- `POST /transcribe` - Upload audio file for transcription
- `GET /health` - Health check endpoint

## How It Works

1. **Audio Capture**: Uses `navigator.mediaDevices.getDisplayMedia()` to capture tab audio
2. **Recording**: Records audio for 5 seconds using Recorder.js
3. **Processing**: Sends audio to Hugging Face Whisper API for transcription
4. **Results**: Displays and allows downloading of transcription results

## Browser Compatibility

- Chrome/Chromium: Full support
- Firefox: Full support
- Safari: Limited support (may require additional permissions)

## Troubleshooting

### "No audio track found" Error
- Make sure to check "Share audio" when selecting the tab
- Ensure the tab is playing audio
- Try refreshing the page and trying again

### "Recorder.js not loaded" Error
- Check your internet connection
- The script is loaded from CDN, ensure it's accessible

### API Errors
- Verify your Hugging Face token is correct
- Check that the token has the necessary permissions
- Ensure the Whisper model is available

## Security Notes

- The Hugging Face token is exposed in the client-side code
- For production use, move the token to environment variables
- Consider implementing rate limiting and authentication

## License

This project is part of the AI-Driven Live Call Insights system. 