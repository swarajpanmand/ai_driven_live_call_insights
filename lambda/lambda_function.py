import json
import boto3
from transcribe import start_transcription
from comprehend import analyze_text
import asyncio

transcribe_client = boto3.client("transcribe", region_name="us-east-1")
comprehend_client = boto3.client("comprehend", region_name="us-east-1")

def lambda_handler(event, context):
    try:
        # Assume audio is uploaded to S3 and event contains S3 bucket/key
        body = json.loads(event["body"])
        audio_s3_uri = body.get("audio_s3_uri")

        if not audio_s3_uri:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing audio_s3_uri"})
            }

        # Start transcription
        loop = asyncio.get_event_loop()
        transcription = loop.run_until_complete(start_transcription(transcribe_client, audio_s3_uri))

        # Analyze transcription
        insights = analyze_text(comprehend_client, transcription["Transcript"])

        return {
            "statusCode": 200,
            "body": json.dumps({
                "transcription": transcription,
                "insights": insights
            })
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        } 