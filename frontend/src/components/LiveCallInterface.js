import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mic, AlertTriangle, CheckCircle, Clock, Users, MicOff } from 'lucide-react';

const LiveCallInterface = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [callSession, setCallSession] = useState(null);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [insights, setInsights] = useState({});
  const [callDuration, setCallDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micError, setMicError] = useState('');
  const [useRealTranscription, setUseRealTranscription] = useState(true);
  const websocketRef = useRef(null);
  const intervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  useEffect(() => {
    // Start call session
    startCallSession();
    
    // Cleanup on unmount
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
          speechRecognitionRef.current = null;
        } catch (error) {
          console.error('Error stopping speech recognition during cleanup:', error);
        }
      }
      setIsRecording(false);
      setIsMicActive(false);
    };
  }, []);

  const startCallSession = async () => {
    try {
      const response = await fetch('/start-live-call/', {
        method: 'POST'
      });
      const data = await response.json();
      setCallSession(data);
      connectWebSocket(data.session_id);
      startCallTimer();
    } catch (error) {
      console.error('Failed to start call session:', error);
    }
  };

  const connectWebSocket = (sessionId) => {
    const ws = new WebSocket(`ws://localhost:8000/ws/live-call/${sessionId}`);
    websocketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connection_established':
            console.log('Call session established');
            break;
            
          case 'live_insights':
            // Only process insights from backend, not transcript data
            // Transcript is now handled directly in the frontend
            if (data.insights && Object.keys(data.insights).length > 0) {
              setInsights(data.insights);
            }
            break;
            
          case 'error':
            console.error('WebSocket error:', data.message);
            setMicError(`Server error: ${data.message}`);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      console.log('WebSocket disconnected:', event.code, event.reason);
      if (event.code !== 1000) {
        setMicError('WebSocket connection lost. Please refresh the page.');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setMicError('WebSocket connection error. Please check your connection.');
    };
  };

  const startCallTimer = () => {
    intervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const startSpeechRecognition = async () => {
    try {
      setMicError('');
      
      // Check if SpeechRecognition is available
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        setMicError('Speech recognition not supported in this browser. Please use Chrome or Edge.');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Set to continuous mode to prevent early termination
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      speechRecognitionRef.current = recognition;
      
      recognition.onstart = () => {
        setIsMicActive(true);
        setIsRecording(true);
        console.log('Speech recognition started');
      };
      
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        // Process only the latest results to avoid repetition
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Only update transcript if we have meaningful final content
        if (finalTranscript.trim()) {
          setLiveTranscript(prev => {
            // Add only the new final transcript
            const newTranscript = prev + finalTranscript.trim();
            const words = newTranscript.split(' ');
            if (words.length > 100) {
              return words.slice(-50).join(' ');
            }
            return newTranscript;
          });
          
          // Send only final transcript to backend for insights analysis
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            websocketRef.current.send(JSON.stringify({
              type: 'transcript_data',
              data: finalTranscript.trim(),
              session_id: callSession?.session_id,
              is_final: true
            }));
          }
        }
        
        // Show interim results in console for debugging
        if (interimTranscript.trim() && !finalTranscript.trim()) {
          console.log('Interim:', interimTranscript);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') { // Don't show error for no-speech
          setMicError(`Speech recognition error: ${event.error}`);
        }
      };
      
      recognition.onend = () => {
        console.log('Speech recognition ended');
        // Only restart if still recording and not manually stopped
        if (isRecording && speechRecognitionRef.current) {
          console.log('Restarting speech recognition...');
          setTimeout(() => {
            if (isRecording && speechRecognitionRef.current) {
              try {
                speechRecognitionRef.current.start();
              } catch (error) {
                console.error('Failed to restart speech recognition:', error);
                setMicError('Failed to restart speech recognition. Please try again.');
              }
            }
          }, 100);
        } else {
          setIsMicActive(false);
        }
      };
      
      recognition.start();
      
    } catch (error) {
      console.error('Speech recognition setup error:', error);
      setMicError('Failed to start speech recognition. Please check microphone permissions.');
    }
  };

  const stopSpeechRecognition = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
    setIsMicActive(false);
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false); // Set this first to prevent restart
      stopSpeechRecognition();
    } else {
      // Clear transcript when starting new recording
      setLiveTranscript('');
      setInsights({}); // Clear previous insights
      setIsRecording(true);
      startSpeechRecognition();
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getUrgencyColor = (level) => {
    switch (level) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      case 'neutral': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className="live-call-container">
      {/* Call Header */}
      <motion.div 
        className="call-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="call-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot" />
            {isConnected ? 'Live Call Active' : 'Connecting...'}
          </div>
          <div className="call-duration">
            <Clock size={16} />
            {formatDuration(callDuration)}
          </div>
        </div>
        
        <div className="call-controls">
          <button 
            className={`record-button ${isRecording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={!isConnected}
          >
            {isRecording ? <Mic size={20} /> : <MicOff size={20} />}
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <button 
            className="clear-button"
            onClick={() => setLiveTranscript('')}
            disabled={!liveTranscript}
          >
            Clear Transcript
          </button>
        </div>
      </motion.div>

      {/* Microphone Error */}
      {micError && (
        <motion.div 
          className="mic-error"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle size={16} />
          <span>{micError}</span>
        </motion.div>
      )}

      {/* Microphone Status */}
      {isMicActive && (
        <motion.div 
          className="mic-status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Mic size={16} />
          <span>Speech Recognition Active - Speak to see real-time transcription</span>
        </motion.div>
      )}

      {/* Transcription Mode Status */}
      <motion.div 
        className="transcription-status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <span>
          <strong>Mode:</strong> Real Speech Recognition (Browser API)
        </span>
      </motion.div>

      <div className="live-content">
        {/* Live Transcript */}
        <motion.div 
          className="live-transcript-panel"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="panel-header">
            <h3>Live Transcript</h3>
            <div className="transcript-indicator">
              <Mic size={16} />
              Real-time
            </div>
          </div>
          
          <div className="transcript-content">
            {liveTranscript ? (
              <div className="transcript-text">
                {liveTranscript}
              </div>
            ) : (
              <div className="transcript-placeholder">
                Start recording to see live transcription...
              </div>
            )}
          </div>
        </motion.div>

        {/* Live Insights */}
        <motion.div 
          className="live-insights-panel"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="panel-header">
            <h3>Live Insights</h3>
            <div className="insights-indicator">
              <AlertTriangle size={16} />
              AI Analysis
            </div>
          </div>

          <div className="insights-content">
            {/* Urgency Level */}
            {insights.urgency && (
              <div className="insight-item urgency">
                <div className="insight-header">
                  <AlertTriangle size={16} />
                  <span>Urgency Level</span>
                </div>
                <div 
                  className="urgency-indicator"
                  style={{ backgroundColor: getUrgencyColor(insights.urgency.level) }}
                >
                  {insights.urgency.level.toUpperCase()}
                </div>
              </div>
            )}

            {/* Sentiment */}
            {insights.sentiment && (
              <div className="insight-item sentiment">
                <div className="insight-header">
                  <Users size={16} />
                  <span>Customer Sentiment</span>
                </div>
                <div 
                  className="sentiment-indicator"
                  style={{ color: getSentimentColor(insights.sentiment) }}
                >
                  {insights.sentiment.toUpperCase()}
                </div>
              </div>
            )}

            {/* Keywords */}
            {insights.keywords && insights.keywords.length > 0 && (
              <div className="insight-item keywords">
                <div className="insight-header">
                  <span>Key Topics</span>
                </div>
                <div className="keywords-list">
                  {insights.keywords.map((keyword, index) => (
                    <span key={index} className="keyword-tag">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {insights.action_items && insights.action_items.length > 0 && (
              <div className="insight-item actions">
                <div className="insight-header">
                  <CheckCircle size={16} />
                  <span>Action Items</span>
                </div>
                <div className="action-list">
                  {insights.action_items.map((action, index) => (
                    <div key={index} className="action-item">
                      • {action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Emotion */}
            {insights.customer_emotion && (
              <div className="insight-item emotion">
                <div className="insight-header">
                  <span>Customer Emotion</span>
                </div>
                <div className="emotion-indicator">
                  {insights.customer_emotion.toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Real-time Suggestions */}
      <AnimatePresence>
        {insights.urgency?.level === 'high' && (
          <motion.div 
            className="urgent-alert"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <AlertTriangle size={20} />
            <span>URGENT: Customer showing high urgency indicators</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveCallInterface; 