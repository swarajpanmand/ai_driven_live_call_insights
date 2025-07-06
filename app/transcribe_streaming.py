import asyncio
import boto3
import json
import websockets
import numpy as np
from botocore.exceptions import ClientError
import random
import time
import base64
import subprocess
import io
import tempfile
import os

# In-memory storage for audio chunks (in production, use Redis or similar)
audio_chunks = {}
# Track last transcription time to prevent spam
last_transcription_time = {}

async def start_streaming_transcription(client, session_id):
    """
    Start real-time streaming transcription using AWS Transcribe
    """
    try:
        # Create streaming transcription session
        response = client.start_stream_transcription(
            LanguageCode='en-US',
            MediaEncoding='pcm',
            MediaSampleRateHertz=16000,
            AudioStream=create_audio_stream(session_id),
            VocabularyName='CallInsightsVocabulary',  # Optional custom vocabulary
            ShowSpeakerLabels=True,
            MaxSpeakerLabels=2,  # For customer and agent
            EnablePartialResultsStabilization=True,
            PartialResultsStability='HIGH'
        )
        
        # Process streaming results
        async for event in response['TranscriptResultStream']:
            if 'TranscriptEvent' in event:
                transcript = event['TranscriptEvent']['Transcript']
                
                # Extract partial results
                for result in transcript['Results']:
                    if not result['IsPartial']:
                        # Final result
                        for alt in result['Alternatives']:
                            yield alt['Transcript']
                    else:
                        # Partial result for real-time display
                        for alt in result['Alternatives']:
                            yield f"[PARTIAL] {alt['Transcript']}"
                            
    except ClientError as e:
        print(f"Transcription error: {e}")
        yield f"Error: {str(e)}"

def create_audio_stream(session_id):
    """
    Create a generator to stream audio data
    This would be connected to your audio input source
    """
    # This is a placeholder - you'd connect this to your audio source
    # For example: microphone, phone system, or call recording
    async def audio_generator():
        # In a real implementation, this would stream audio from:
        # - Phone system integration
        # - Microphone input
        # - Call recording system
        # - VoIP stream
        pass
    
    return audio_generator()

async def process_audio_chunk(audio_data, session_id, is_pcm=False):
    """
    Process individual audio chunks for real-time transcription
    If is_pcm is True, treat audio_data as PCM; otherwise, convert from WebM/Opus
    """
    try:
        current_time = time.time()
        if session_id in last_transcription_time:
            if current_time - last_transcription_time[session_id] < 0.5:  # Reduced to 0.5 seconds
                return ""
        await asyncio.sleep(0.1)  # Reduced delay
        if len(audio_data) > 50:  # Reduced threshold
            transcript = simulate_transcription(audio_data)
            if transcript:
                last_transcription_time[session_id] = current_time
            return transcript
        return ""
    except Exception as e:
        print(f"Error processing audio chunk: {e}")
        return ""

def convert_webm_to_pcm(webm_bytes):
    """
    Convert WebM/Opus audio bytes to PCM 16kHz mono using ffmpeg subprocess
    Returns raw PCM bytes
    """
    try:
        print(f"Converting {len(webm_bytes)} bytes of WebM audio to PCM...")
        
        # Check if the data looks like a valid WebM file
        if len(webm_bytes) < 4 or webm_bytes[:4] != b'\x1a\x45\xdf\xa3':
            print("Warning: Data doesn't look like a valid WebM file")
            # Try to create a proper WebM container
            webm_bytes = create_webm_container(webm_bytes)
        
        # Create temporary files for input and output
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as input_file:
            input_file.write(webm_bytes)
            input_path = input_file.name
        
        with tempfile.NamedTemporaryFile(suffix='.pcm', delete=False) as output_file:
            output_path = output_file.name
        
        # Use ffmpeg to convert WebM to PCM
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-f', 's16le',  # 16-bit little-endian
            '-ar', '16000',  # 16kHz sample rate
            '-ac', '1',      # mono
            '-y',            # overwrite output
            output_path
        ]
        
        print(f"Running ffmpeg command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr}")
            # Try alternative approach - treat as raw audio
            return convert_raw_audio_to_pcm(webm_bytes)
        
        # Read the PCM data
        with open(output_path, 'rb') as f:
            pcm_data = f.read()
        
        print(f"Successfully converted to {len(pcm_data)} bytes of PCM audio")
        
        # Clean up temporary files
        os.unlink(input_path)
        os.unlink(output_path)
        
        return pcm_data
        
    except Exception as e:
        print(f"Audio conversion error: {e}")
        return b""

def create_webm_container(audio_data):
    """
    Create a minimal WebM container for audio data
    """
    # This is a simplified WebM container structure
    # In production, you'd use a proper WebM library
    webm_header = b'\x1a\x45\xdf\xa3'  # EBML header
    webm_data = webm_header + audio_data
    return webm_data

def convert_raw_audio_to_pcm(audio_data):
    """
    Fallback: Convert raw audio data to PCM
    """
    try:
        print("Attempting raw audio conversion...")
        
        # Create temporary files
        with tempfile.NamedTemporaryFile(suffix='.raw', delete=False) as input_file:
            input_file.write(audio_data)
            input_path = input_file.name
        
        with tempfile.NamedTemporaryFile(suffix='.pcm', delete=False) as output_file:
            output_path = output_file.name
        
        # Try to convert as raw audio
        cmd = [
            'ffmpeg',
            '-f', 'webm',  # Try webm format
            '-i', input_path,
            '-f', 's16le',
            '-ar', '16000',
            '-ac', '1',
            '-y',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            with open(output_path, 'rb') as f:
                pcm_data = f.read()
            
            os.unlink(input_path)
            os.unlink(output_path)
            return pcm_data
        
        # If that fails, return empty
        os.unlink(input_path)
        os.unlink(output_path)
        return b""
        
    except Exception as e:
        print(f"Raw audio conversion error: {e}")
        return b""

def simulate_transcription(audio_data):
    """
    Simulate transcription for demo purposes
    In production, replace this with actual AWS Transcribe streaming API calls
    """
    # This is a placeholder function
    # In a real implementation, you would:
    # 1. Convert audio data to the format expected by AWS Transcribe
    # 2. Send to AWS Transcribe streaming API
    # 3. Receive and return the transcription
    
    # For demo purposes, return a sample transcription based on audio intensity
    audio_intensity = np.mean(audio_data) if len(audio_data) > 0 else 0
    
    # More varied and realistic transcriptions
    if audio_intensity > 150:
        # High intensity - customer might be urgent
        sample_transcriptions = [
            "I need help immediately with my order!",
            "This is very urgent, please help me now!",
            "I'm extremely frustrated with this service!",
            "This is unacceptable, I want to speak to a manager!",
            "I've been waiting for hours, this is ridiculous!",
            "My order is completely wrong!",
            "This is the worst customer service ever!",
            "I demand to speak to someone right now!",
            "This is absolutely ridiculous!",
            "I'm never using this service again!"
        ]
    elif audio_intensity > 100:
        # Medium intensity - normal conversation
        sample_transcriptions = [
            "Hello, I'm calling about my order.",
            "I need help with my account.",
            "There's an issue with my payment.",
            "Can you help me with this problem?",
            "I have a question about my service.",
            "I'd like to check on my order status.",
            "Can you tell me about my account?",
            "I need to update my information.",
            "What are my payment options?",
            "How do I cancel my subscription?"
        ]
    else:
        # Low intensity - quiet speech
        sample_transcriptions = [
            "Hello, how are you today?",
            "I was wondering about my order.",
            "Could you please help me?",
            "I have a small question.",
            "Thank you for your time.",
            "Excuse me, I have a question.",
            "I'm calling about my account.",
            "Can you assist me please?",
            "I need some information.",
            "Thanks for your help."
        ]
    
    # Add some randomness to make it more realistic
    if random.random() < 0.4:  # 40% chance to return empty
        return ""
    
    return random.choice(sample_transcriptions)

async def start_real_transcription(audio_data, session_id):
    """
    Start real AWS Transcribe streaming
    Accepts WebM bytes, converts to PCM, streams to AWS
    """
    try:
        # audio_data is already bytes from WebM blob
        webm_bytes = audio_data
        pcm_bytes = convert_webm_to_pcm(webm_bytes)
        if not pcm_bytes:
            return ""
        # AWS Transcribe streaming expects a generator yielding PCM chunks
        def pcm_stream():
            chunk_size = 3200  # 100ms of 16kHz 16-bit mono
            for i in range(0, len(pcm_bytes), chunk_size):
                yield pcm_bytes[i:i+chunk_size]
        transcribe_client = boto3.client('transcribe', region_name='ap-south-1')
        response = transcribe_client.start_stream_transcription(
            LanguageCode='en-US',
            MediaEncoding='pcm',
            MediaSampleRateHertz=16000,
            AudioStream=pcm_stream(),
            ShowSpeakerLabels=True,
            MaxSpeakerLabels=2,
            EnablePartialResultsStabilization=True,
            PartialResultsStability='HIGH'
        )
        for event in response['TranscriptResultStream']:
            if 'TranscriptEvent' in event:
                transcript = event['TranscriptEvent']['Transcript']
                for result in transcript['Results']:
                    if not result['IsPartial']:
                        for alt in result['Alternatives']:
                            return alt['Transcript']
        return ""
    except Exception as e:
        print(f"Real transcription error: {e}")
        return "" 