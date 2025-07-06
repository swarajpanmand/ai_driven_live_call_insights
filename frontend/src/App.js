import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, AlertCircle, Loader, Phone, Upload } from 'lucide-react';
import AudioUploader from './components/AudioUploader';
import TranscriptionDisplay from './components/TranscriptionDisplay';
import InsightsDisplay from './components/InsightsDisplay';
import LiveCallInterface from './components/LiveCallInterface';
import TestInstructions from './components/TestInstructions';
import './App.css';

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('upload'); // 'upload' or 'live'

  const handleFileUpload = async (file) => {
    console.log('File uploaded:', file);
    setIsProcessing(true);
    setError('');
    setTranscription('');
    setInsights(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('Sending request to backend...');
      const response = await fetch('/start-transcription/', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Backend response:', data);
      setTranscription(data.transcription);
      setInsights(data.insights);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="app">
      <motion.header 
        className="header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="header-content">
          <div className="logo">
            <Brain className="logo-icon" />
            <h1>AI Call Insights</h1>
          </div>
          <p className="subtitle">Real-time transcription and intelligent analysis</p>
        </div>
      </motion.header>

      <main className="main-content">
        <div className="container">
          {/* Mode Toggle */}
          <motion.div 
            className="mode-toggle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="toggle-buttons">
              <button 
                className={`toggle-btn ${mode === 'upload' ? 'active' : ''}`}
                onClick={() => setMode('upload')}
              >
                <Upload size={20} />
                File Upload
              </button>
              <button 
                className={`toggle-btn ${mode === 'live' ? 'active' : ''}`}
                onClick={() => setMode('live')}
              >
                <Phone size={20} />
                Live Call
              </button>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {mode === 'upload' ? (
              <motion.div 
                key="upload-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div 
                  className="upload-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <AudioUploader 
                    onFileUpload={handleFileUpload}
                    isProcessing={isProcessing}
                  />
                </motion.div>

                <AnimatePresence>
                  {isProcessing && (
                    <motion.div 
                      className="processing-indicator"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Loader className="spinner" />
                      <p>Processing audio and generating insights...</p>
                    </motion.div>
                  )}

                  {error && (
                    <motion.div 
                      className="error-message"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <AlertCircle className="error-icon" />
                      <p>{error}</p>
                    </motion.div>
                  )}

                  {transcription && (
                    <motion.div 
                      className="results-section"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                    >
                      <TranscriptionDisplay transcription={transcription} />
                      {insights && <InsightsDisplay insights={insights} />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div 
                key="live-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <TestInstructions />
                <LiveCallInterface />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="footer">
        <p>Powered by AWS Transcribe & Comprehend</p>
      </footer>
    </div>
  );
}

export default App; 