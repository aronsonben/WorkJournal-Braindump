"use client";
import { useState, useRef, useCallback, useEffect } from 'react';

// Type definitions for Transformers.js
interface TransformersModule {
  pipeline: (task: string, model: string, options?: {
    progress_callback?: (progress: { progress?: number }) => void;
    quantized?: boolean;
  }) => Promise<WhisperPipeline>;
  env: {
    allowLocalModels: boolean;
    backends?: {
      onnx?: {
        wasm?: {
          numThreads?: number;
        };
      };
    };
  };
}

interface WhisperPipeline {
  (audio: Float32Array, options?: { 
    return_timestamps?: boolean;
    chunk_length_s?: number;
    stride_length_s?: number;
  }): Promise<{ text: string }>;
}

// Singleton instances
let whisperModel: WhisperPipeline | null = null;
let audioContext: AudioContext | null = null;

// Convert audio blob to 16kHz PCM format required by Whisper
async function convertToWhisperFormat(blob: Blob): Promise<Float32Array> {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || ((window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AudioCtx) {
      throw new Error('AudioContext not supported in this browser');
    }
    audioContext = new AudioCtx();
  }
  
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // If already 16kHz, return as-is
  if (audioBuffer.sampleRate === 16000) {
    return audioBuffer.getChannelData(0);
  }
  
  // Resample to 16kHz using OfflineAudioContext
  const offlineContext = new OfflineAudioContext(
    1, // mono
    Math.ceil(audioBuffer.duration * 16000),
    16000 // target sample rate
  );
  
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();
  
  const resampled = await offlineContext.startRendering();
  return resampled.getChannelData(0);
}

// Get best supported audio format for recording
function getAudioMimeType(): string {
  const formats = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  
  return formats.find(format => MediaRecorder.isTypeSupported(format)) || '';
}

export function useWhisper() {
  // State management
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Refs for recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Initialize Whisper model
  const initializeModel = useCallback(async () => {
    if (isModelLoading || whisperModel) return;
    
    setIsModelLoading(true);
    setError(null);
    setLoadingProgress(0);
    
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Browser does not support audio recording');
      }

      // Import and configure Transformers.js
      const transformers = await import('@xenova/transformers') as unknown as TransformersModule;
      
      // Configure environment (only once)
      transformers.env.allowLocalModels = false;
      if (transformers.env.backends?.onnx?.wasm) {
        transformers.env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
      }

      // Load Whisper model
      whisperModel = await transformers.pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        {
          quantized: true,
          progress_callback: (progress) => {
            if (typeof progress.progress === 'number') {
              setLoadingProgress(Math.round(progress.progress * 100));
            }
          },
        }
      );
      
      setIsModelReady(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Whisper';
      setError(message);
      console.error('Whisper initialization error:', err);
    } finally {
      setIsModelLoading(false);
      setLoadingProgress(0);
    }
  }, [isModelLoading]);

  // Stop recording and transcribe
  const stopRecording = useCallback(async (): Promise<string> => {
    if (!mediaRecorderRef.current || !isRecording) {
      return '';
    }
    
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current!;
      
      recorder.onstop = async () => {
        setIsRecording(false);
        
        // Stop audio tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
        
        // Create audio blob from chunks
        if (audioChunksRef.current.length === 0) {
          setError('No audio recorded');
          resolve('');
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: getAudioMimeType() 
        });
        
        // Transcribe the audio
        if (whisperModel) {
          setIsTranscribing(true);
          try {
            const audioData = await convertToWhisperFormat(audioBlob);
            const result = await whisperModel(audioData, {
              chunk_length_s: 30,
              stride_length_s: 5,
            });
            
            const text = (result.text || '').trim();
            setTranscript(text);
            resolve(text);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Transcription failed';
            setError(message);
            console.error('Transcription error:', err);
            resolve('');
          } finally {
            setIsTranscribing(false);
          }
        } else {
          setError('Model not loaded');
          resolve('');
        }
        
        audioChunksRef.current = [];
      };
      
      recorder.stop();
    });
  }, [isRecording]);

  // Start recording audio
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    
    // Initialize model if needed
    if (!whisperModel && !isModelLoading) {
      await initializeModel();
    }
    
    if (!isModelReady) {
      setError('Model not ready. Please wait for initialization.');
      return;
    }
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Request 16kHz if possible
        }
      });
      
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      
      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: getAudioMimeType(),
        audioBitsPerSecond: 128000,
      });
      
      // Collect audio data
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Handle errors
      recorder.onerror = (event) => {
        console.error('Recording error:', event);
        setError('Recording failed');
        stopRecording();
      };
      
      mediaRecorderRef.current = recorder;
      recorder.start();
      
      setIsRecording(true);
      setTranscript(''); // Clear previous transcript
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      console.error('Recording start error:', err);
    }
  }, [isRecording, isModelReady, isModelLoading, initializeModel, stopRecording]);

  // Toggle recording on/off
  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      return await stopRecording();
    } else {
      await startRecording();
      return '';
    }
  }, [isRecording, startRecording, stopRecording]);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    // State
    isModelLoading,
    isModelReady,
    isRecording,
    isTranscribing,
    transcript,
    error,
    loadingProgress,
    
    // Actions
    initializeModel,
    startRecording,
    stopRecording,
    toggleRecording,
    clearTranscript,
  };
}