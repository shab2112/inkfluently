"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lsGet, lsSet } from "./storage";

export function useVoice() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string | null>(() => lsGet("ink_voiceURI", null));
  const lastSpokenVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    function refresh() {
      const all = window.speechSynthesis.getVoices() || [];
      const english = all.filter((v) => /^en/i.test(v.lang));
      setVoices(english.length ? english : all);
    }
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  const setVoiceURI = useCallback((uri: string) => {
    setVoiceURIState(uri);
    lsSet("ink_voiceURI", uri);
  }, []);

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;
    if (voiceURI) {
      const chosen = voices.find((v) => v.voiceURI === voiceURI);
      if (chosen) return chosen;
    }
    return voices[0];
  }, [voices, voiceURI]);

  const speak = useCallback(
    (text: string, rate: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      const voice = pickVoice();
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = "en-US";
      }
      lastSpokenVoiceRef.current = voice;
      window.speechSynthesis.speak(u);
      return voice;
    },
    [pickVoice]
  );

  return { voices, voiceURI, setVoiceURI, speak, supported: typeof window !== "undefined" && "speechSynthesis" in window };
}
