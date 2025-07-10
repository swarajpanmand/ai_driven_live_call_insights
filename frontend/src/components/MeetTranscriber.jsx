import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Download } from 'lucide-react';

const MeetTranscriber = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready to capture Google Meet audio');
  
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);

  const startRecording = async () => {
    try {
      console.log("🎙 Starting audio capture...");
      setIsRecording(true);
      setError('');
      setTranscription('');
      setStatus('Capturing Meet audio...');
      
      // Capture audio from the selected tab
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required for tab audio in most browsers
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      streamRef.current = stream;
      console.log("✅ Stream captured:", stream);
      setStatus('✅ Capturing Meet audio');

      // Check if audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio track found. Make sure to share audio when selecting the tab.");
      }

      // Set up AudioContext and Recorder
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const sourceNode = audioContext.createMediaStreamSource(stream);
      
      audioContextRef.current = audioContext;
      sourceNodeRef.current = sourceNode;

      // Ensure Recorder.js is available
      if (typeof window.Recorder === "undefined") {
        throw new Error("Recorder.js not loaded");
      }

      const recorder = new window.Recorder(sourceNode, {
        numChannels: 1,
      });
      
      recorderRef.current = recorder;

      // Start recording
      recorder.record();
      console.log("🎙 Recording started...");
      setStatus('🎙 Recording for 5 seconds...');

      // Stop after 5 seconds and process
      setTimeout(() => {
        stopRecording();
      }, 5000);
      
    } catch (err) {
      console.error("❌ Failed to capture audio:", err);
      setError(`Capture failed: ${err.message}`);
      setStatus('❌ Setup failed');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    
    console.log("⏹ Stopping recording...");
    recorderRef.current.stop();
    setStatus('🔄 Processing audio...');
    setIsProcessing(true);
    
    recorderRef.current.exportWAV(async (blob) => {
      console.log("📄 Audio blob created:", blob.size, "bytes");
      
      // Convert WAV blob to correct format for Hugging Face
      const formData = new FormData();
      formData.append("audio", blob, "audio.wav");

      try {
        setStatus('🤖 Sending to AI for transcription...');
        
        console.log("📡 Sending request to server...");
        
        const response = await fetch("http://localhost:5000/transcribe", {
          method: "POST",
          body: formData,
        });

        console.log("📡 Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ API Error:", errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log("📝 Transcription result:", result);

        if (result.text) {
          setTranscription(result.text);
          setStatus('✅ Transcription complete!');
        } else if (result.error) {
          setError(`API Error: ${result.error}`);
          setStatus('❌ Transcription failed');
        } else {
          setError('No transcription returned');
          setStatus('❌ No result');
        }
      } catch (err) {
        console.error("❌ Transcription failed:", err);
        setError(`Transcription failed: ${err.message}`);
        setStatus('❌ Error occurred');
      } finally {
        cleanup();
        setIsProcessing(false);
        setIsRecording(false);
      }
    });
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current.clear();
      recorderRef.current = null;
    }
    sourceNodeRef.current = null;
  };

  const downloadTranscription = () => {
    if (!transcription) return;
    
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meet-transcription-${new Date().toISOString().slice(0, 19)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      className="meet-transcriber"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="meet-transcriber-header">
        <h2>🎙️ Google Meet Audio Transcriber</h2>
        <p>Capture and transcribe audio from Google Meet tabs</p>
      </div>

      <div className="instructions">
        <h3>📋 How to use:</h3>
        <ol>
          <li>Click "Start Recording" button</li>
          <li>Select the Google Meet tab when prompted</li>
          <li><strong>Important:</strong> Make sure to check "Share audio" when selecting the tab</li>
          <li>The system will record for 5 seconds and transcribe the audio</li>
          <li>View the transcription results below</li>
        </ol>
      </div>

      <div className="controls">
        <motion.button
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isRecording ? (
            <>
              <Square size={20} />
              Stop Recording
            </>
          ) : (
            <>
              <Mic size={20} />
              Start Recording
            </>
          )}
        </motion.button>

        {transcription && (
          <motion.button
            className="download-btn"
            onClick={downloadTranscription}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download size={20} />
            Download
          </motion.button>
        )}

        {error && error.includes('Audio recording library failed to load') && (
          <motion.button
            className="retry-btn"
            onClick={() => {
              setError('');
              loadRecorderJS().then(() => {
                setStatus('✅ Recorder.js loaded successfully. Try recording again.');
              }).catch(err => {
                setError('Failed to load recording library. Please refresh the page.');
              });
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🔄 Retry Loading Library
          </motion.button>
        )}
      </div>

      <div className={`status ${error ? 'error' : ''} ${isRecording ? 'recording' : ''}`}>
        {status}
      </div>

      {error && (
        <motion.div 
          className="error-message"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          ❌ {error}
        </motion.div>
      )}

      {transcription && (
        <motion.div 
          className="transcription-result"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3>📝 Transcription Result:</h3>
          <div className="transcription-text">
            {transcription}
          </div>
        </motion.div>
      )}

      <style jsx>{`
        .meet-transcriber {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 25px;
          margin: 20px 0;
          backdrop-filter: blur(10px);
        }

        .meet-transcriber-header {
          text-align: center;
          margin-bottom: 20px;
        }

        .meet-transcriber-header h2 {
          margin: 0 0 10px 0;
          color: #ffd700;
        }

        .meet-transcriber-header p {
          margin: 0;
          opacity: 0.8;
        }

        .instructions {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }

        .instructions h3 {
          margin-top: 0;
          color: #ffd700;
        }

        .instructions ol {
          margin: 0;
          padding-left: 20px;
        }

        .instructions li {
          margin: 10px 0;
          line-height: 1.5;
        }

        .controls {
          display: flex;
          gap: 15px;
          justify-content: center;
          margin: 20px 0;
          flex-wrap: wrap;
        }

        .record-btn, .download-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border: none;
          border-radius: 25px;
          font-size: 1em;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .record-btn {
          background: linear-gradient(45deg, #ff6b6b, #ee5a24);
          color: white;
        }

        .record-btn.recording {
          background: linear-gradient(45deg, #ff4757, #ff3838);
          animation: pulse 1s infinite;
        }

        .download-btn {
          background: linear-gradient(45deg, #2ed573, #1e90ff);
          color: white;
        }

        .record-btn:disabled, .download-btn:disabled {
          background: #666;
          cursor: not-allowed;
          animation: none;
        }

        .retry-btn {
          background: linear-gradient(45deg, #ffa500, #ff8c00);
          color: white;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }

        .status {
          background: rgba(255, 255, 255, 0.2);
          padding: 15px;
          border-radius: 10px;
          margin: 20px 0;
          text-align: center;
          font-weight: bold;
          font-size: 1.1em;
        }

        .status.error {
          background: rgba(255, 0, 0, 0.2);
          border: 1px solid #ff0000;
          color: #ffcccc;
        }

        .status.recording {
          background: rgba(255, 165, 0, 0.2);
          border: 1px solid #ffa500;
          color: #ffd700;
          animation: pulse 1s infinite;
        }

        .error-message {
          background: rgba(255, 0, 0, 0.2);
          border: 1px solid #ff0000;
          color: #ffcccc;
          padding: 15px;
          border-radius: 10px;
          margin: 20px 0;
        }

        .transcription-result {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }

        .transcription-result h3 {
          margin-top: 0;
          color: #ffd700;
        }

        .transcription-text {
          background: rgba(255, 255, 255, 0.1);
          padding: 15px;
          border-radius: 8px;
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          font-size: 1em;
          line-height: 1.6;
          max-height: 300px;
          overflow-y: auto;
        }
      `}</style>
    </motion.div>
  );
};

export default MeetTranscriber; 