# AI-Driven Live Call Insights
A GenAI Hackathon project using AWS Transcribe and Comprehend for real-time call insights.

## Setup
1. Install dependencies: `pip install -r app/requirements.txt`
2. Configure AWS CLI: `aws configure`
3. Run locally: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

## API Endpoints
- POST `/start-transcription/`: Upload audio for transcription and insights.
- GET `/health`: Check API status.

## AWS Configuration
- Ensure IAM permissions for Transcribe, Comprehend, Lambda, CloudWatch, S3, and KMS.
- Create and attach the required IAM role to your Lambda function.

## Deployment
- Local: Run FastAPI app as above.
- Lambda: Use `deploy.sh` to package and deploy Lambda function.

## Security
- Use KMS for encryption.
- Restrict IAM policies.
- Ensure data compliance (e.g., GDPR).

## Testing
- Unit test `transcribe.py` and `comprehend.py` with `pytest` and `moto`.
- Integration test via `/start-transcription/` endpoint.

## Notes
- For real-time streaming, use AWS Transcribe streaming API.
- Monitor AWS usage for cost optimization. # ai_driven_live_call_insights
# ai_driven_live_call_insights
