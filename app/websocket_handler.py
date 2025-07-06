import asyncio
import json
import boto3
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect
from .transcribe_streaming import start_streaming_transcription, process_audio_chunk, start_real_transcription
from .comprehend import analyze_text_chunk
import uuid
import base64

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict = {}
        self.transcribe_clients: dict = {}
        self.audio_buffers: dict = {}
        
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.transcribe_clients[client_id] = boto3.client("transcribe", region_name="ap-south-1")
        self.audio_buffers[client_id] = []
        print(f"Client {client_id} connected")
        
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.transcribe_clients:
            del self.transcribe_clients[client_id]
        if client_id in self.audio_buffers:
            del self.audio_buffers[client_id]
        print(f"Client {client_id} disconnected")
            
    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(json.dumps(message))
            except Exception as e:
                print(f"Error sending message to client {client_id}: {e}")
                self.disconnect(client_id)

manager = ConnectionManager()

async def websocket_endpoint(websocket: WebSocket, client_id: str = None):
    if not client_id:
        client_id = str(uuid.uuid4())
    
    await manager.connect(websocket, client_id)
    
    try:
        # Send connection confirmation
        await manager.send_personal_message({
            "type": "connection_established",
            "client_id": client_id,
            "message": "Connected to live call insights"
        }, client_id)
        
        # Listen for messages from client
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "audio_data":
                    # Process incoming audio data
                    try:
                        # Decode base64 audio data
                        audio_data_base64 = message["data"]
                        audio_data_bytes = base64.b64decode(audio_data_base64)
                        use_real_transcription = message.get("use_real_transcription", False)
                        
                        # Add to buffer
                        manager.audio_buffers[client_id].extend(audio_data_bytes)
                        
                        # Process audio chunk for transcription
                        transcript_chunk = ""
                        if use_real_transcription:
                            try:
                                transcript_chunk = await start_real_transcription(audio_data_bytes, client_id)
                                if not transcript_chunk:
                                    print("Real transcription failed, falling back to simulation")
                                    # Fallback to simulation if real transcription fails
                                    audio_data_array = np.frombuffer(audio_data_bytes, dtype=np.uint8)
                                    transcript_chunk = await process_audio_chunk(audio_data_array, client_id)
                            except Exception as e:
                                print(f"Real transcription error: {e}, falling back to simulation")
                                # Fallback to simulation
                                audio_data_array = np.frombuffer(audio_data_bytes, dtype=np.uint8)
                                transcript_chunk = await process_audio_chunk(audio_data_array, client_id)
                        else:
                            # Use simulation
                            audio_data_array = np.frombuffer(audio_data_bytes, dtype=np.uint8)
                            transcript_chunk = await process_audio_chunk(audio_data_array, client_id)
                        
                        if transcript_chunk and transcript_chunk.strip():
                            # Analyze transcript for insights
                            insights = analyze_text_chunk(transcript_chunk)
                            
                            # Send real-time results
                            await manager.send_personal_message({
                                "type": "live_insights",
                                "transcript": transcript_chunk,
                                "insights": insights,
                                "timestamp": asyncio.get_event_loop().time()
                            }, client_id)
                        else:
                            # Send empty transcript to keep connection alive
                            await manager.send_personal_message({
                                "type": "live_insights",
                                "transcript": "",
                                "insights": {},
                                "timestamp": asyncio.get_event_loop().time()
                            }, client_id)
                            
                    except Exception as e:
                        print(f"Error processing audio data: {e}")
                        # Send error message but keep connection alive
                        await manager.send_personal_message({
                            "type": "error",
                            "message": f"Audio processing error: {str(e)}"
                        }, client_id)
                        
                elif message.get("type") == "transcript_data":
                    # Process incoming transcript data from speech recognition
                    try:
                        transcript_text = message["data"]
                        is_final = message.get("is_final", False)
                        
                        if transcript_text and transcript_text.strip():
                            # Analyze transcript for insights
                            insights = analyze_text_chunk(transcript_text)
                            
                            # Send real-time results
                            await manager.send_personal_message({
                                "type": "live_insights",
                                "transcript": transcript_text,
                                "insights": insights,
                                "timestamp": asyncio.get_event_loop().time()
                            }, client_id)
                            
                    except Exception as e:
                        print(f"Error processing transcript data: {e}")
                        await manager.send_personal_message({
                            "type": "error",
                            "message": f"Transcript processing error: {str(e)}"
                        }, client_id)
                
            except json.JSONDecodeError as e:
                print(f"Invalid JSON received from client {client_id}: {e}")
                continue
            except Exception as e:
                print(f"Error processing message from client {client_id}: {e}")
                # Send error but keep connection alive
                await manager.send_personal_message({
                    "type": "error",
                    "message": f"Message processing error: {str(e)}"
                }, client_id)
                continue
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for client {client_id}")
        manager.disconnect(client_id)
    except Exception as e:
        print(f"WebSocket error for client {client_id}: {e}")
        await manager.send_personal_message({
            "type": "error",
            "message": str(e)
        }, client_id)
        manager.disconnect(client_id) 