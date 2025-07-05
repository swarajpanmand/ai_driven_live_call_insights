import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Hash } from 'lucide-react';

const InsightsDisplay = ({ insights }) => {
  const { Sentiment, SentimentScore, Entities, KeyPhrases } = insights;

  const getSentimentColor = (sentiment) => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return 'var(--success-color)';
      case 'negative': return 'var(--error-color)';
      case 'mixed': return 'var(--warning-color)';
      default: return 'var(--text-secondary)';
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      case 'mixed': return '😐';
      default: return '😐';
    }
  };

  return (
    <motion.div 
      className="insights-card"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="card-header">
        <TrendingUp className="card-icon" />
        <h2 className="card-title">AI Insights</h2>
      </div>

      {/* Sentiment Analysis */}
      <div className="sentiment-section">
        <h3 className="section-title">
          Sentiment Analysis {getSentimentIcon(Sentiment)}
        </h3>
        <div style={{ 
          padding: '1rem', 
          background: 'var(--bg-secondary)', 
          borderRadius: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{ 
            fontSize: '1.2rem', 
            fontWeight: '600', 
            color: getSentimentColor(Sentiment),
            marginBottom: '1rem'
          }}>
            {Sentiment.charAt(0).toUpperCase() + Sentiment.slice(1)}
          </div>
          
          {Object.entries(SentimentScore).map(([key, value]) => (
            <div key={key} className="sentiment-score">
              <span className="sentiment-label">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </span>
              <div className="sentiment-bar">
                <div 
                  className={`sentiment-fill ${key.toLowerCase()}`}
                  style={{ width: `${(value * 100).toFixed(1)}%` }}
                />
              </div>
              <span className="sentiment-value">
                {(value * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Entities */}
      {Entities && Entities.length > 0 && (
        <div className="entities-section">
          <h3 className="section-title">
            <Users style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
            Entities Detected
          </h3>
          <div>
            {Entities.map((entity, index) => (
              <span key={index} className="entity-item">
                {entity.Text}
                <span className="entity-type">({entity.Type})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Phrases */}
      {KeyPhrases && KeyPhrases.length > 0 && (
        <div className="keyphrases-section">
          <h3 className="section-title">
            <Hash style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
            Key Phrases
          </h3>
          <div>
            {KeyPhrases.map((phrase, index) => (
              <span key={index} className="keyphrase-item">
                {phrase.Text}
              </span>
            ))}
          </div>
        </div>
      )}

      {(!Entities || Entities.length === 0) && (!KeyPhrases || KeyPhrases.length === 0) && (
        <div style={{ 
          textAlign: 'center', 
          color: 'var(--text-secondary)', 
          padding: '2rem' 
        }}>
          <p>No entities or key phrases detected in this audio.</p>
        </div>
      )}
    </motion.div>
  );
};

export default InsightsDisplay; 