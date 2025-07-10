import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Download, AlertCircle, CheckCircle, Clock } from 'lucide-react';

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
      setStatus('🎙 Recording... Click "Stop Recording" when done');
      
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
        <div className="header-icon">
          <Mic size={32} />
        </div>
        <h2>Google Meet Audio Transcriber</h2>
        <p>Capture and transcribe audio from Google Meet tabs in real-time</p>
      </div>

      <div className="instructions-card">
        <div className="card-header">
          <Clock size={20} />
          <h3>How to use</h3>
        </div>
        <div className="instructions-content">
          <ol>
            <li>Click the "Start Recording" button below</li>
            <li>Select the Google Meet tab when prompted by your browser</li>
            <li><strong>Important:</strong> Make sure to check "Share audio" when selecting the tab</li>
            <li>Click "Stop Recording" when you want to end the recording</li>
            <li>View the transcription results in the panel below</li>
          </ol>
        </div>
      </div>

      <div className="controls-section">
        <motion.button
          className={`record-button ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
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
            className="download-button"
            onClick={downloadTranscription}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={20} />
            Download
          </motion.button>
        )}
      </div>

      <div className={`status-indicator ${error ? 'error' : ''} ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}>
        <div className="status-icon">
          {error ? <AlertCircle size={20} /> : 
           isRecording ? <Mic size={20} /> : 
           isProcessing ? <Clock size={20} /> : 
           <CheckCircle size={20} />}
        </div>
        <span className="status-text">{status}</span>
      </div>

      {error && (
        <motion.div 
          className="error-message"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </motion.div>
      )}

      {transcription && (
        <motion.div 
          className="transcription-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="card-header">
            <Mic size={20} />
            <h3>Transcription Result</h3>
          </div>
          <div className="transcription-text">
            {transcription}
          </div>
        </motion.div>
      )}

      <style jsx>{`
        .meet-transcriber {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 1.5rem;
          padding: 3rem;
          box-shadow: var(--shadow-lg);
          margin: 2rem 0;
        }

        .meet-transcriber-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .header-icon {
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
          color: var(--primary-color);
        }

        .meet-transcriber-header h2 {
          margin: 0 0 0.5rem 0;
          color: var(--text-primary);
          font-size: 2rem;
          font-weight: 700;
        }

        .meet-transcriber-header p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 1.1rem;
        }

        .instructions-card {
          background: rgba(255, 255, 255, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          margin: 2rem 0;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          color: var(--text-primary);
        }

        .card-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .instructions-content ol {
          margin: 0;
          padding-left: 1.5rem;
          color: var(--text-secondary);
        }

        .instructions-content li {
          margin: 0.75rem 0;
          line-height: 1.6;
        }

        .controls-section {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin: 2rem 0;
          flex-wrap: wrap;
        }

        .record-button, .download-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.75rem;
          border: none;
          border-radius: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: var(--shadow-sm);
        }

        .record-button {
          background: var(--primary-color);
          color: white;
        }

        .record-button:hover:not(:disabled) {
          background: var(--primary-dark);
          box-shadow: var(--shadow-md);
        }

        .record-button.recording {
          background: var(--error-color);
          animation: pulse 1s infinite;
        }

        .download-button {
          background: var(--success-color);
          color: white;
        }

        .download-button:hover {
          background: var(--success-dark);
          box-shadow: var(--shadow-md);
        }

        .record-button:disabled, .download-button:disabled {
          background: var(--text-tertiary);
          cursor: not-allowed;
          animation: none;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-radius: 0.75rem;
          margin: 2rem 0;
          font-weight: 500;
        }

        .status-indicator:not(.error):not(.recording):not(.processing) {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: var(--success-color);
        }

        .status-indicator.recording {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--error-color);
          animation: pulse 1s infinite;
        }

        .status-indicator.processing {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: var(--primary-color);
        }

        .status-indicator.error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: var(--error-color);
        }

        .status-icon {
          flex-shrink: 0;
        }

        .status-text {
          font-size: 1rem;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.75rem;
          margin: 2rem 0;
          color: var(--error-color);
        }

        .transcription-card {
          background: rgba(255, 255, 255, 0.5);
          border-radius: 1rem;
          padding: 1.5rem;
          margin: 2rem 0;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .transcription-text {
          background: rgba(0, 0, 0, 0.05);
          padding: 1.5rem;
          border-radius: 0.75rem;
          white-space: pre-wrap;
          font-family: 'Courier New', monospace;
          font-size: 1rem;
          line-height: 1.6;
          max-height: 400px;
          overflow-y: auto;
          color: var(--text-primary);
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
          .meet-transcriber {
            padding: 2rem 1.5rem;
          }
          
          .controls-section {
            flex-direction: column;
            align-items: center;
          }
          
          .record-button, .download-button {
            width: 100%;
            max-width: 300px;
            justify-content: center;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default MeetTranscriber; 