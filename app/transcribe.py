import boto3
import time
import asyncio

async def start_transcription(client, audio_file_path):
    job_name = f"transcription-{int(time.time())}"
    try:
        client.start_transcription_job(
            TranscriptionJobName=job_name,
            LanguageCode="en-IN",
            MediaFormat="mp3",  # Adjust based on your audio format
            Media={"MediaFileUri": audio_file_path}  # Pass S3 URI directly
        )

        # Poll for transcription completion
        while True:
            status = client.get_transcription_job(TranscriptionJobName=job_name)
            if status["TranscriptionJob"]["TranscriptionJobStatus"] in ["COMPLETED", "FAILED"]:
                break
            await asyncio.sleep(5)

        if status["TranscriptionJob"]["TranscriptionJobStatus"] == "COMPLETED":
            transcript = status["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
            return {"Transcript": transcript, "JobName": job_name}
        else:
            raise Exception("Transcription job failed")
    except Exception as e:
        raise Exception(f"Transcription error: {str(e)}") 