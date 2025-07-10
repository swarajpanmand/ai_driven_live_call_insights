import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Download, AlertCircle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react';

const MeetTranscriber = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [realTimeTranscriptions, setRealTimeTranscriptions] = useState([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Ready to capture Google Meet audio');
  const [isRealTimeMode, setIsRealTimeMode] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);
  const [captureMode, setCaptureMode] = useState('both'); // 'meet', 'microphone', 'both'
  
  const streamRef = useRef(null);
  const meetStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    let reconnectTimeout;
    
    const connectWebSocket = () => {
      try {
        console.log('🔌 Attempting WebSocket connection...');
        const ws = new WebSocket('ws://localhost:5000');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('🔌 WebSocket connected successfully');
          setWsConnected(true);
          setError(''); // Clear any connection errors
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 Received WebSocket message:', data);
            if (data.type === 'transcription') {
              setRealTimeTranscriptions(prev => [...prev, data]);
              const speakerPrefix = data.speaker ? `[${data.speaker}]: ` : '';
              setTranscription(prev => prev + (prev ? '\n' : '') + speakerPrefix + data.text);
            }
          } catch (err) {
            console.error('❌ Error parsing WebSocket message:', err);
          }
        };

        ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected:', event.code, event.reason);
          setWsConnected(false);
          
          // Only attempt to reconnect if not a clean close
          if (event.code !== 1000) {
            console.log('🔄 Attempting to reconnect in 3 seconds...');
            reconnectTimeout = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          setWsConnected(false);
        };
      } catch (err) {
        console.error('❌ Failed to connect WebSocket:', err);
        setWsConnected(false);
        setError('WebSocket connection failed');
      }
    };

    // Initial connection
    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log("🎙 Starting audio capture...");
      setIsRecording(true);
      setError('');
      setTranscription('');
      setRealTimeTranscriptions([]);
      setStatus('Capturing audio...');
      
      let combinedStream = null;
      
      if (captureMode === 'both' || captureMode === 'meet') {
        // Capture audio from the selected tab (Meet)
        const meetStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Required for tab audio in most browsers
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        
        meetStreamRef.current = meetStream;
        console.log("✅ Meet stream captured:", meetStream);
        
        // Check if audio track exists
        const audioTracks = meetStream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error("No audio track found. Make sure to share audio when selecting the tab.");
        }
        
        combinedStream = meetStream;
      }
      
      if (captureMode === 'both' || captureMode === 'microphone') {
        // Capture microphone audio
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        
        micStreamRef.current = micStream;
        console.log("✅ Microphone stream captured:", micStream);
        
        if (combinedStream) {
          // Combine both streams
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const meetSource = audioContext.createMediaStreamSource(meetStreamRef.current);
          const micSource = audioContext.createMediaStreamSource(micStream);
          
          const destination = audioContext.createMediaStreamDestination();
          meetSource.connect(destination);
          micSource.connect(destination);
          
          combinedStream = destination.stream;
          audioContextRef.current = audioContext;
        } else {
          combinedStream = micStream;
        }
      }
      
      streamRef.current = combinedStream;
      setStatus(`✅ Capturing ${captureMode === 'both' ? 'Meet + Microphone' : captureMode} audio`);

      // Set up AudioContext and Recorder
      const audioContext = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      const sourceNode = audioContext.createMediaStreamSource(combinedStream);
      
      if (!audioContextRef.current) {
        audioContextRef.current = audioContext;
      }
      sourceNodeRef.current = sourceNode;

      // Ensure Recorder.js is available
      if (typeof window.Recorder === "undefined") {
        throw new Error("Recorder.js not loaded");
      }

      const recorder = new window.Recorder(sourceNode, {
        numChannels: 2, // Stereo for better audio quality
      });
      
      recorderRef.current = recorder;

      // Start recording
      recorder.record();
      console.log("🎙 Recording started...");
      
      if (isRealTimeMode) {
        console.log("🎙 Starting in REAL-TIME mode");
        setStatus('🎙 Real-time recording... Sending data every 5 seconds');
        // Start the interval after a short delay to ensure recording is active
        setTimeout(() => {
          // Check if we're still recording and have a recorder
          if (recorderRef.current) {
            console.log("✅ Starting real-time transcription after delay");
            setIsRealTimeActive(true);
            startRealTimeTranscription();
          } else {
            console.log("❌ Recorder not available after delay");
          }
        }, 1000);
      } else {
        console.log("🎙 Starting in REGULAR mode");
        setStatus('🎙 Recording... Click "Stop Recording" when done');
      }
      
    } catch (err) {
      console.error("❌ Failed to capture audio:", err);
      setError(`Capture failed: ${err.message}`);
      setStatus('❌ Setup failed');
      setIsRecording(false);
    }
  };

  const startRealTimeTranscription = () => {
    console.log("🚀 Starting real-time transcription with 5-second intervals");
    
    // Send audio chunks every 5 seconds for real-time transcription
    intervalRef.current = setInterval(async () => {
      console.log("⏰ Interval triggered at", new Date().toLocaleTimeString());
      console.log("📊 Recorder state:", !!recorderRef.current);
      
      if (!recorderRef.current) {
        console.log("❌ Recorder not available, skipping chunk");
        return;
      }
      
      // Don't check isRecording state here since it might be stale
      // Just check if we have a valid recorder
      
      try {
        console.log("🔄 Processing real-time audio chunk at", new Date().toLocaleTimeString());
        
        // Check if recorder is actually recording before stopping
        if (!recorderRef.current.recording) {
          console.log("⚠️ Recorder not actively recording, restarting");
          recorderRef.current.record();
          return;
        }
        
        // Stop current recording to export
        recorderRef.current.stop();
        
        recorderRef.current.exportWAV(async (blob) => {
          console.log("📄 Real-time audio blob created:", blob.size, "bytes");
          
          if (blob.size < 1000) {
            console.log("⚠️ Audio blob too small, skipping");
            // Restart recording immediately
            if (recorderRef.current) {
              recorderRef.current.clear();
              recorderRef.current.record();
              console.log("🎙 Restarted recording after small blob");
            }
            return;
          }
          
          // Process audio based on capture mode
          if (captureMode === 'both') {
            // Send separate requests for Meet and Microphone
            await processSeparateAudioStreams(blob);
          } else {
            // Send single request for single source
            await processSingleAudioStream(blob, captureMode);
          }
          
          // Restart recording for the next chunk
          if (recorderRef.current) {
            recorderRef.current.clear();
            recorderRef.current.record();
            console.log("🎙 Restarted recording for next chunk");
          }
        });
        
      } catch (err) {
        console.error("❌ Real-time processing error:", err);
        setStatus(`❌ Processing error: ${err.message}`);
        
        // Try to restart recording even if there was an error
        if (recorderRef.current) {
          recorderRef.current.clear();
          recorderRef.current.record();
          console.log("🎙 Restarted recording after error");
        }
      }
    }, 5000); // 5 seconds interval
  };

  const processSingleAudioStream = async (blob, source) => {
    const formData = new FormData();
    formData.append("audio", blob, "audio.wav");
    formData.append("audioSource", source);

    try {
      setStatus(`🔄 Sending ${source} chunk to server at ${new Date().toLocaleTimeString()}`);
      
      const response = await fetch("http://localhost:5000/transcribe-stream", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Real-time API Error:", errorText);
        setStatus(`❌ API Error: ${response.status}`);
      } else {
        const result = await response.json();
        console.log("📝 Real-time transcription chunk:", result);
        setStatus(`✅ ${source} chunk processed at ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error("❌ Real-time transcription failed:", err);
      setStatus(`❌ Network error: ${err.message}`);
    }
  };

  const processSeparateAudioStreams = async (blob) => {
    // For combined audio, use enhanced speaker detection
    const formData = new FormData();
    formData.append("audio", blob, "audio.wav");
    formData.append("audioSource", "both");

    try {
      setStatus(`🔄 Sending combined audio with enhanced speaker detection at ${new Date().toLocaleTimeString()}`);
      
      const response = await fetch("http://localhost:5000/transcribe-stream", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Real-time API Error:", errorText);
        setStatus(`❌ API Error: ${response.status}`);
      } else {
        const result = await response.json();
        console.log("📝 Real-time transcription chunk:", result);
        setStatus(`✅ Combined chunk processed at ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error("❌ Real-time transcription failed:", err);
      setStatus(`❌ Network error: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current) return;
    
    console.log("⏹ Stopping recording...");
    
    // Clear real-time interval if active
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log("🧹 Cleared real-time interval");
    }
    
    setIsRealTimeActive(false);
    
    recorderRef.current.stop();
    setStatus('🔄 Processing final audio...');
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
          setTranscription(prev => prev + (prev ? '\n' : '') + result.text);
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
    // Clear real-time interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log("🧹 Cleared real-time interval");
    }
    
    setIsRealTimeActive(false);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (meetStreamRef.current) {
      meetStreamRef.current.getTracks().forEach(track => track.stop());
      meetStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
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

  const toggleSpeaker = (index) => {
    setRealTimeTranscriptions(prev => {
      const updated = [...prev];
      const chunk = updated[index];
      chunk.speaker = chunk.speaker === 'You' ? 'Other Person' : 'You';
      return updated;
    });
    
    // Also update the main transcription
    setTranscription(prev => {
      const lines = prev.split('\n');
      const updatedLines = lines.map((line, i) => {
        if (i === index) {
          const speakerPrefix = realTimeTranscriptions[index].speaker === 'You' ? 'Other Person' : 'You';
          return line.replace(/^\[.*?\]: /, `[${speakerPrefix}]: `);
        }
        return line;
      });
      return updatedLines.join('\n');
    });
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
            <li>Select audio source: "Meet + Microphone" (recommended), "Meet Only", or "Microphone Only"</li>
            <li>Toggle "Real-time Mode" for live transcription updates (optional)</li>
            <li>Ensure WebSocket connection is established (green "Connected" indicator)</li>
            <li>Click the "Start Recording" button below</li>
            <li>If capturing Meet audio: Select the Google Meet tab when prompted</li>
            <li><strong>Important:</strong> Make sure to check "Share audio" when selecting the tab</li>
            <li>If capturing microphone: Grant microphone permissions when prompted</li>
            <li>In real-time mode, transcriptions will appear every 5 seconds with speaker detection</li>
            <li><strong>Speaker Correction:</strong> Click the 🔄 button next to any transcription to toggle between "You" and "Other Person"</li>
            <li>Click "Stop Recording" when you want to end the recording</li>
            <li>View the transcription results in the panel below</li>
          </ol>
        </div>
      </div>

      <div className="controls-section">
        <div className="capture-mode-selector">
          <label className="mode-label">Audio Source:</label>
          <select 
            value={captureMode} 
            onChange={(e) => setCaptureMode(e.target.value)}
            disabled={isRecording}
            className="mode-select"
          >
            <option value="both">Meet + Microphone</option>
            <option value="meet">Meet Only</option>
            <option value="microphone">Microphone Only</option>
          </select>
        </div>

        <div className="mode-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={isRealTimeMode}
              onChange={(e) => setIsRealTimeMode(e.target.checked)}
              disabled={isRecording}
            />
            <span className="toggle-text">Real-time Mode</span>
          </label>
        </div>

        <div className="connection-status">
          {wsConnected ? (
            <div className="status-connected">
              <Wifi size={16} />
              <span>Connected</span>
            </div>
          ) : (
            <div className="status-disconnected">
              <WifiOff size={16} />
              <span>Disconnected</span>
            </div>
          )}
        </div>

        {isRealTimeMode && isRealTimeActive && (
          <div className="realtime-indicator">
            <div className="pulse-dot"></div>
            <span>Real-time Active</span>
          </div>
        )}

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

              {isRealTimeMode && realTimeTranscriptions.length > 0 && (
          <motion.div 
            className="realtime-transcriptions-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="card-header">
              <Wifi size={20} />
              <h3>Real-time Transcriptions</h3>
              <span className="chunk-count">{realTimeTranscriptions.length} chunks</span>
            </div>
            <div className="realtime-transcriptions-list">
              {realTimeTranscriptions.map((chunk, index) => (
                <div key={index} className={`transcription-chunk ${chunk.speaker === 'You' ? 'speaker-you' : 'speaker-other'}`}>
                  <div className="chunk-header">
                    <span className="chunk-time">
                      {new Date(chunk.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="speaker-controls">
                      <span className={`chunk-speaker ${chunk.speaker === 'You' ? 'speaker-you-badge' : 'speaker-other-badge'}`}>
                        {chunk.speaker || 'Unknown'}
                      </span>
                      <button 
                        className="speaker-toggle"
                        onClick={() => toggleSpeaker(index)}
                        title="Toggle speaker"
                      >
                        🔄
                      </button>
                    </div>
                    <span className="chunk-confidence">
                      Confidence: {Math.round(chunk.confidence * 100)}%
                    </span>
                  </div>
                  <div className="chunk-text">{chunk.text}</div>
                </div>
              ))}
            </div>
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

      <style>{`
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
          align-items: center;
          margin: 2rem 0;
          flex-wrap: wrap;
        }

        .capture-mode-selector {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .mode-label {
          font-weight: 500;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .mode-select {
          padding: 0.5rem;
          border: 1px solid rgba(0, 0, 0, 0.2);
          border-radius: 0.5rem;
          background: white;
          font-size: 0.9rem;
          cursor: pointer;
        }

        .mode-select:disabled {
          background: rgba(0, 0, 0, 0.1);
          cursor: not-allowed;
        }

        .mode-toggle {
          display: flex;
          align-items: center;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-weight: 500;
          color: var(--text-primary);
        }

        .toggle-label input[type="checkbox"] {
          width: 1.2rem;
          height: 1.2rem;
          accent-color: var(--primary-color);
        }

        .toggle-text {
          font-size: 0.9rem;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .status-connected {
          background: rgba(34, 197, 94, 0.1);
          color: var(--success-color);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .status-disconnected {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-color);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .realtime-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(59, 130, 246, 0.1);
          color: var(--primary-color);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: var(--primary-color);
          border-radius: 50%;
          animation: pulse 1s infinite;
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

        .realtime-transcriptions-card {
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

        .chunk-count {
          margin-left: auto;
          background: var(--primary-color);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .realtime-transcriptions-list {
          max-height: 300px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .transcription-chunk {
          background: rgba(0, 0, 0, 0.03);
          border-radius: 0.75rem;
          padding: 1rem;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .chunk-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .chunk-time {
          font-weight: 600;
        }

        .speaker-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .chunk-speaker {
          padding: 0.2rem 0.5rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .speaker-you-badge {
          background: rgba(34, 197, 94, 0.1);
          color: var(--success-color);
        }

        .speaker-other-badge {
          background: rgba(59, 130, 246, 0.1);
          color: var(--primary-color);
        }

        .speaker-toggle {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.8rem;
          padding: 0.2rem;
          border-radius: 0.3rem;
          transition: background-color 0.2s;
        }

        .speaker-toggle:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .chunk-confidence {
          background: rgba(59, 130, 246, 0.1);
          color: var(--primary-color);
          padding: 0.2rem 0.5rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
        }

        .chunk-text {
          font-family: 'Courier New', monospace;
          font-size: 0.95rem;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .transcription-chunk.speaker-you {
          border-left: 4px solid var(--success-color);
          background: rgba(34, 197, 94, 0.05);
        }

        .transcription-chunk.speaker-other {
          border-left: 4px solid var(--primary-color);
          background: rgba(59, 130, 246, 0.05);
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