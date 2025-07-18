from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from .transcribe import start_transcription
from .comprehend import analyze_text
from .websocket_handler import websocket_endpoint
import asyncio
import boto3
import os
import uuid
import requests

app = FastAPI(title="AI-Driven Live Call Insights")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to your frontend's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AWS clients
transcribe_client = boto3.client("transcribe", region_name="ap-south-1")
comprehend_client = boto3.client("comprehend", region_name="ap-south-1")
s3_client = boto3.client("s3", region_name="ap-south-1")
S3_BUCKET = "callinsightawsgenai"

# WebSocket endpoint for real-time call insights
@app.websocket("/ws/live-call/{session_id}")
async def websocket_endpoint_route(websocket: WebSocket, session_id: str):
    await websocket_endpoint(websocket, session_id)

@app.post("/start-transcription/")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        # Save uploaded audio temporarily
        audio_path = f"/tmp/{file.filename}"
        with open(audio_path, "wb") as f:
            f.write(await file.read())

        # Upload to S3
        s3_key = f"uploads/{uuid.uuid4()}_{file.filename}"
        s3_client.upload_file(audio_path, S3_BUCKET, s3_key)
        s3_uri = f"s3://{S3_BUCKET}/{s3_key}"

        # Start transcription job with S3 URI
        transcription = await start_transcription(transcribe_client, s3_uri)
        transcript_url = transcription["Transcript"]

        # Fetch transcript text from S3 URL
        transcript_text = get_transcript_text(transcript_url)

        # Analyze transcription with Comprehend
        insights = analyze_text(comprehend_client, transcript_text)

        return JSONResponse({
            "transcription": transcript_text,
            "insights": insights
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/", response_class=HTMLResponse)
async def root():
    with open(os.path.join(os.path.dirname(__file__), "../templates/index.html")) as f:
        return f.read()

@app.get("/manifest.json")
async def get_manifest():
    return FileResponse("frontend/public/manifest.json")

# Live call insights endpoints
@app.post("/start-live-call/")
async def start_live_call():
    """Start a new live call session"""
    session_id = str(uuid.uuid4())
    return {
        "session_id": session_id,
        "websocket_url": f"ws://localhost:8000/ws/live-call/{session_id}",
        "status": "ready"
    }

@app.get("/call-insights/{session_id}")
async def get_call_insights(session_id: str):
    """Get insights for a specific call session"""
    # This would return insights from the session
    return {
        "session_id": session_id,
        "insights": {
            "total_duration": "00:05:30",
            "customer_sentiment": "positive",
            "urgency_level": "medium",
            "action_items": ["refund", "escalation"],
            "keywords": ["billing", "payment", "issue"]
        }
    }

def get_transcript_text(transcript_url):
    response = requests.get(transcript_url)
    data = response.json()
    return data['results']['transcripts'][0]['transcript']

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

    # Test AWS permissions
    client = boto3.client("sts")
    print(client.get_caller_identity()) 