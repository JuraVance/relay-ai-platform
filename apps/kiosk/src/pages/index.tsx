import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3001';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'fa', label: 'فارسی' },
  { code: 'zh', label: '中文' },
];

export default function Home() {
  const [screen, setScreen] = useState<'welcome' | 'conversation'>('welcome');
  const [language, setLanguage] = useState('en');
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [transcript, setTranscript] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [state, setState] = useState<any>(null);
  const [pulseSize, setPulseSize] = useState(1);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pulseRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Pulse animation when listening
  useEffect(() => {
    if (isListening) {
      pulseRef.current = setInterval(() => {
        setPulseSize(s => s === 1 ? 1.3 : 1);
      }, 600);
    } else {
      clearInterval(pulseRef.current);
      setPulseSize(1);
    }
    return () => clearInterval(pulseRef.current);
  }, [isListening]);

  const playAudio = async (text: string) => {
    try {
      setIsSpeaking(true);
      const res = await fetch(`${API_URL}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        // Auto start listening after Relay speaks
        startListening();
      };
      audio.play();
    } catch {
      setIsSpeaking(false);
    }
  };

  const startSession = async (lang: string) => {
    setLanguage(lang);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kioskId: 'kiosk-1', language: lang }),
      });
      const data = await res.json();
      setState(data.state);
      setScreen('conversation');

      const msgRes = await fetch(`${API_URL}/api/sessions/${data.sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello', state: data.state }),
      });
      const msgData = await msgRes.json();
      setMessages([{ role: 'relay', text: msgData.response }]);
      setState(msgData.state);
      await playAudio(msgData.response);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || isSpeaking) return;
    setInput('');
    setTranscript('');
    setMessages(prev => [...prev, { role: 'customer', text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, state }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'relay', text: data.response }]);
      setState(data.state);
      await playAudio(data.response);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const startListening = async () => {
    if (isSpeaking || isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setIsListening(true);
      setTranscript('');

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);
        stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // Send to backend for transcription
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('language', language);

        try {
          const res = await fetch(`${API_URL}/api/voice/transcribe-form`, {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();
          if (data.text && data.text.trim()) {
            setTranscript(data.text);
            await sendMessage(data.text);
          }
        } catch (err) {
          console.error('Transcription error:', err);
        }
      };

      mediaRecorder.start();

      // Auto stop after 8 seconds of silence or user taps
    } catch (err) {
      console.error('Mic error:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
    }
  };

  // WELCOME SCREEN
  if (screen === 'welcome') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0a0a0a 0%, #0d1117 60%, #0f1923 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
        color: 'white',
        padding: '40px',
      }}>
        {/* Dealer name */}
        <div style={{
          fontSize: '11px',
          letterSpacing: '5px',
          opacity: 0.35,
          marginBottom: '48px',
          textTransform: 'uppercase',
        }}>
          NewRoads Mazda
        </div>

        {/* Relay wordmark */}
        <img
          src="/Relay Official Logo.png"
          alt="Relay"
          style={{
            width: '280px',
            marginBottom: '24px',
            filter: 'drop-shadow(0 0 40px rgba(30,100,255,0.4))',
          }}
        />

        <p style={{
          fontSize: '15px',
          opacity: 0.5,
          marginBottom: '72px',
          fontWeight: '200',
          letterSpacing: '6px',
          textTransform: 'uppercase',
        }}>
          Your Personal Automotive Companion
        </p>

        {/* Language selector */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '48px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              style={{
                background: language === lang.code ? 'rgba(255,255,255,0.15)' : 'transparent',
                border: `1px solid ${language === lang.code ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
                color: language === lang.code ? 'white' : 'rgba(255,255,255,0.4)',
                padding: '8px 18px',
                borderRadius: '50px',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
              {lang.label}
            </button>
          ))}
        </div>

        {/* Begin button */}
        <button
          onClick={() => startSession(language)}
          disabled={loading}
          style={{
            background: 'white',
            color: '#0a0a0a',
            border: 'none',
            padding: '20px 72px',
            borderRadius: '50px',
            fontSize: '17px',
            fontWeight: '600',
            cursor: 'pointer',
            letterSpacing: '0.3px',
            boxShadow: '0 0 40px rgba(255,255,255,0.15)',
            transition: 'all 0.2s',
          }}>
          {loading ? 'Starting...' : 'Begin'}
        </button>

        <p style={{ marginTop: '32px', fontSize: '12px', opacity: 0.2 }}>
          Tap and speak — Relay understands you
        </p>
      </div>
    );
  }

  // CONVERSATION SCREEN
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      color: 'white',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 28px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.5px' }}>Relay</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSpeaking && (
            <div style={{
              display: 'flex', gap: '3px', alignItems: 'center'
            }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{
                  width: '3px',
                  height: `${8 + i * 4}px`,
                  background: '#4ade80',
                  borderRadius: '2px',
                  animation: `wave${i} 0.8s ease-in-out infinite`,
                }} />
              ))}
            </div>
          )}
          <div style={{ fontSize: '11px', opacity: 0.3, letterSpacing: '2px' }}>
            {isSpeaking ? 'SPEAKING' : isListening ? 'LISTENING' : state?.currentStage}
          </div>
        </div>
        <div style={{ fontSize: '11px', opacity: 0.3 }}>NewRoads Mazda</div>
      </div>

      {/* Conversation area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'customer' ? 'flex-end' : 'flex-start',
          }}>
            {msg.role === 'relay' && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', marginRight: '10px', flexShrink: 0, marginTop: '4px',
              }}>R</div>
            )}
            <div style={{
              maxWidth: '60%',
              padding: '12px 18px',
              borderRadius: msg.role === 'customer' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'customer'
                ? 'linear-gradient(135deg, #0f3460, #1a4a7a)'
                : 'rgba(255,255,255,0.07)',
              fontSize: '15px',
              lineHeight: '1.6',
              color: 'white',
            }}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Live transcript */}
        {transcript && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <div style={{
              maxWidth: '60%',
              padding: '12px 18px',
              borderRadius: '18px 18px 4px 18px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.15)',
              fontSize: '15px',
              lineHeight: '1.6',
              color: 'rgba(255,255,255,0.6)',
              fontStyle: 'italic',
            }}>
              {transcript}
            </div>
          </div>
        )}

        {loading && !isListening && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px',
            }}>R</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.4)',
                  animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice orb + text input */}
      <div style={{
        padding: '20px 28px 32px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
      }}>
        {/* Voice orb - main interaction */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isSpeaking || loading}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            border: 'none',
            background: isListening
              ? 'radial-gradient(circle, #ef4444, #dc2626)'
              : 'radial-gradient(circle, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
            cursor: isSpeaking || loading ? 'default' : 'pointer',
            transform: `scale(${isListening ? pulseSize : 1})`,
            transition: 'transform 0.3s ease, background 0.3s ease',
            boxShadow: isListening
              ? '0 0 30px rgba(239,68,68,0.4)'
              : '0 0 20px rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}>
          {isListening ? '⏹' : isSpeaking ? '🔊' : '🎤'}
        </button>

        <div style={{ fontSize: '11px', opacity: 0.3, letterSpacing: '1px' }}>
          {isListening ? 'TAP TO SEND' : isSpeaking ? 'RELAY IS SPEAKING' : 'TAP TO SPEAK'}
        </div>

        {/* Text input (secondary) */}
        <div style={{
          display: 'flex',
          gap: '10px',
          width: '100%',
          maxWidth: '500px',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Or type here..."
            disabled={loading || isSpeaking || isListening}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '50px',
              padding: '12px 20px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || isSpeaking || isListening || !input.trim()}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '50px',
              padding: '12px 24px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              opacity: !input.trim() ? 0.3 : 1,
            }}>
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}