"use client";

import { useCallback, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type VoiceInputState = {
  isRecording: boolean;
  isTranscribing: boolean;
  error: string | null;
};

export type VoiceInputActions = {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  resetError: () => void;
};

export function useVoiceInput(): VoiceInputState & VoiceInputActions {
  const { locale, t } = useI18n();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    try {
      setIsTranscribing(true);
      const formData = new FormData();
      formData.append("audio", audioBlob);
      formData.append("locale", locale);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t("api.error.transcriptionFailed"));
      }

      const data = await response.json();
      return data.transcript || null;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("api.error.transcriptionFailed");
      setError(message);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [locale, t]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : undefined;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setError(t("api.error.recording"));
        setIsRecording(false);
        cleanup();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "NotAllowedError"
            ? t("api.error.microphoneDenied")
            : err.message
          : t("api.error.recordingStart");
      setError(message);
      setIsRecording(false);
    }
  }, [cleanup, t]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        cleanup();

        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          resolve(null);
          return;
        }

        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(chunks, { type: mimeType });
        audioChunksRef.current = [];

        const transcript = await transcribeAudio(audioBlob);
        resolve(transcript);
      };

      recorder.stop();
    });
  }, [cleanup, transcribeAudio]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
    resetError,
  };
}
