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