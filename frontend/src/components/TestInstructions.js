import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Monitor, Video, AlertCircle, CheckCircle } from 'lucide-react';

const TestInstructions = () => {
  return (
    <motion.div 
      className="test-instructions"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h3>Testing Options for Live Call Interface</h3>
      
      <div className="test-options">
        {/* Option 1: Microphone Testing */}
        <motion.div 
          className="test-option"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="option-header">
            <Mic size={24} />
            <h4>Microphone Testing (Current)</h4>
            <CheckCircle size={20} className="status-icon" />
          </div>
          <p>✅ <strong>Ready to test!</strong></p>
          <ul>
            <li>Click "Start Recording" to enable microphone</li>
            <li>Allow microphone permissions when prompted</li>
            <li>Speak into your microphone to test transcription</li>
            <li>Real-time insights will appear as you speak</li>
          </ul>
          <div className="note">
            <AlertCircle size={16} />
            <span>This is the easiest way to test the live interface</span>
          </div>
        </motion.div>

        {/* Option 2: Screen Capture (Future) */}
        <motion.div 
          className="test-option"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="option-header">
            <Monitor size={24} />
            <h4>Screen Audio Capture (Future)</h4>
            <AlertCircle size={20} className="status-icon future" />
          </div>
          <p>🔄 <strong>Requires additional development</strong></p>
          <ul>
            <li>Capture audio from YouTube videos</li>
            <li>Record audio from Google Meet calls</li>
            <li>Capture system audio from any application</li>
            <li>Real-time transcription of screen audio</li>
          </ul>
          <div className="note">
            <AlertCircle size={16} />
            <span>Would require browser extensions or desktop apps</span>
          </div>
        </motion.div>

        {/* Option 3: Video Call Integration (Future) */}
        <motion.div 
          className="test-option"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="option-header">
            <Video size={24} />
            <h4>Video Call Integration (Future)</h4>
            <AlertCircle size={20} className="status-icon future" />
          </div>
          <p>🔄 <strong>Advanced integration required</strong></p>
          <ul>
            <li>Direct integration with Google Meet API</li>
            <li>Zoom SDK integration</li>
            <li>Microsoft Teams integration</li>
            <li>Real-time call analysis during meetings</li>
          </ul>
          <div className="note">
            <AlertCircle size={16} />
            <span>Requires API access and platform-specific development</span>
          </div>
        </motion.div>
      </div>

      <div className="current-status">
        <h4>Current Implementation Status</h4>
        <div className="status-grid">
          <div className="status-item">
            <CheckCircle size={16} />
            <span>WebSocket connection</span>
          </div>
          <div className="status-item">
            <CheckCircle size={16} />
            <span>Microphone audio capture</span>
          </div>
          <div className="status-item">
            <CheckCircle size={16} />
            <span>Real-time transcript display</span>
          </div>
          <div className="status-item">
            <CheckCircle size={16} />
            <span>Live insights analysis</span>
          </div>
          <div className="status-item future">
            <AlertCircle size={16} />
            <span>Screen audio capture</span>
          </div>
          <div className="status-item future">
            <AlertCircle size={16} />
            <span>Video call integration</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TestInstructions; 