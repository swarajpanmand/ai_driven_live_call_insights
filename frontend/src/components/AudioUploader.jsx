import React, { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, Mic } from 'lucide-react';

const AudioUploader = ({ onFileUpload, isProcessing }) => {
  const fileInputRef = useRef(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.flac', '.aac']
    },
    multiple: false
  });

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <motion.div 
      className="upload-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div 
        {...getRootProps()} 
        className={`upload-area ${isDragActive ? 'dragover' : ''}`}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Upload className="upload-icon" />
        </motion.div>
        <div className="upload-text">
          <h3>Upload Audio File</h3>
          <p>Drag and drop your audio file here, or click to browse</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Supports: MP3, WAV, M4A, FLAC, AAC
          </p>
        </div>
        <button 
          className="upload-button"
          disabled={isProcessing}
          onClick={handleButtonClick}
          type="button"
        >
          {isProcessing ? 'Processing...' : 'Choose File'}
        </button>
      </div>
      
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="processing-status"
          style={{ marginTop: '1rem', textAlign: 'center' }}
        >
          <Mic style={{ width: '2rem', height: '2rem', color: 'var(--primary-color)' }} />
          <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
            Analyzing your audio...
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AudioUploader; 