import boto3
import asyncio
from typing import Dict, List

def analyze_text(client, text):
    try:
        # Sentiment Analysis
        sentiment_response = client.detect_sentiment(
            Text=text,
            LanguageCode="en"
        )

        # Entity Recognition
        entities_response = client.detect_entities(
            Text=text,
            LanguageCode="en"
        )

        # Key Phrase Extraction
        key_phrases_response = client.detect_key_phrases(
            Text=text,
            LanguageCode="en"
        )

        return {
            "Sentiment": sentiment_response["Sentiment"],
            "SentimentScore": sentiment_response["SentimentScore"],
            "Entities": entities_response["Entities"],
            "KeyPhrases": key_phrases_response["KeyPhrases"]
        }
    except Exception as e:
        raise Exception(f"Comprehend error: {str(e)}")

def analyze_text_chunk(text_chunk: str) -> Dict:
    """
    Analyze a small chunk of text for real-time insights
    Optimized for speed and minimal latency
    """
    try:
        comprehend_client = boto3.client("comprehend", region_name="ap-south-1")
        
        # For real-time, we focus on key insights that matter during calls
        insights = {
            "urgency": detect_urgency(text_chunk),
            "sentiment": quick_sentiment_check(text_chunk),
            "keywords": extract_keywords(text_chunk),
            "action_items": detect_action_items(text_chunk),
            "customer_emotion": analyze_customer_emotion(text_chunk)
        }
        
        return insights
    except Exception as e:
        return {"error": str(e)}

def detect_urgency(text: str) -> Dict:
    """Detect urgency indicators in customer speech"""
    urgency_words = [
        "urgent", "immediately", "asap", "right now", "emergency",
        "critical", "important", "priority", "rush", "hurry"
    ]
    
    text_lower = text.lower()
    urgency_score = sum(1 for word in urgency_words if word in text_lower)
    
    return {
        "level": "high" if urgency_score > 2 else "medium" if urgency_score > 0 else "low",
        "score": urgency_score,
        "indicators": [word for word in urgency_words if word in text_lower]
    }

def quick_sentiment_check(text: str) -> str:
    """Quick sentiment analysis for real-time feedback"""
    positive_words = ["good", "great", "excellent", "happy", "satisfied", "love", "amazing"]
    negative_words = ["bad", "terrible", "angry", "frustrated", "hate", "awful", "disappointed"]
    
    text_lower = text.lower()
    positive_count = sum(1 for word in positive_words if word in text_lower)
    negative_count = sum(1 for word in negative_words if word in text_lower)
    
    if positive_count > negative_count:
        return "positive"
    elif negative_count > positive_count:
        return "negative"
    else:
        return "neutral"

def extract_keywords(text: str) -> List[str]:
    """Extract important keywords for real-time suggestions"""
    # Common customer service keywords
    keywords = []
    
    # Product/service keywords
    product_words = ["product", "service", "account", "billing", "payment", "order"]
    for word in product_words:
        if word in text.lower():
            keywords.append(word)
    
    # Issue keywords
    issue_words = ["problem", "issue", "error", "broken", "not working", "failed"]
    for word in issue_words:
        if word in text.lower():
            keywords.append(word)
    
    return keywords

def detect_action_items(text: str) -> List[str]:
    """Detect action items that need to be addressed"""
    action_indicators = [
        "need to", "want to", "would like to", "can you", "please",
        "help me", "fix this", "resolve", "change", "update"
    ]
    
    actions = []
    text_lower = text.lower()
    
    for indicator in action_indicators:
        if indicator in text_lower:
            actions.append(indicator)
    
    return actions

def analyze_customer_emotion(text: str) -> str:
    """Analyze customer emotional state for agent guidance"""
    emotion_indicators = {
        "frustrated": ["frustrated", "annoyed", "irritated", "upset"],
        "angry": ["angry", "mad", "furious", "outraged"],
        "satisfied": ["happy", "pleased", "satisfied", "content"],
        "confused": ["confused", "unsure", "uncertain", "don't understand"],
        "anxious": ["worried", "concerned", "anxious", "nervous"]
    }
    
    text_lower = text.lower()
    emotion_scores = {}
    
    for emotion, words in emotion_indicators.items():
        score = sum(1 for word in words if word in text_lower)
        if score > 0:
            emotion_scores[emotion] = score
    
    if emotion_scores:
        return max(emotion_scores, key=emotion_scores.get)
    else:
        return "neutral" 