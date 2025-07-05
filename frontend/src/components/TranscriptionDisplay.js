import React from 'react';
import { motion } from 'framer-motion';
import { FileText } from 'lucide-react';

const TranscriptionDisplay = ({ transcription }) => {
  return (
    <motion.div 
      className="transcription-card"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="card-header">
        <FileText className="card-icon" />
        <h2 className="card-title">Transcription</h2>
      </div>
      
      <div className="transcription-text">
        {transcription || 'No transcription available'}
      </div>
      
      <div style={{ 
        marginTop: '1rem', 
        fontSize: '0.9rem', 
        color: 'var(--text-secondary)',
        textAlign: 'right'
      }}>
        {transcription && `${transcription.split(' ').length} words`}
      </div>
    </motion.div>
  );
};

export default TranscriptionDisplay; 