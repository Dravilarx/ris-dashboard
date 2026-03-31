import { useState, useRef, useEffect } from 'react';

interface UseVoiceDictationProps {
  onTranscriptionSuccess: (transcribedText: string) => void;
  onError?: (error: string) => void;
}

export function useVoiceDictation({ onTranscriptionSuccess, onError }: UseVoiceDictationProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        
        try {
          const formData = new FormData();
          formData.append('file', audioBlob);

          const res = await fetch('/api/dictado/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`Error en transcripción: ${res.statusText}`);
          }
          
          const data = await res.json();
          if (data.text) {
            onTranscriptionSuccess(data.text);
          }
        } catch (error: any) {
          console.error("Transcription failed", error);
          if (onError) onError(error.message);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error("Microphone access denied or failed", error);
      if (onError) onError("No se pudo acceder al micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    toggleRecording
  };
}
