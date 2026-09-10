import { useState, useRef } from 'react';

const API_URL = 'http://localhost:3001';
const DEALER_ID = '5c474542-46d7-4ed3-a73d-9cb17ff4b5d7';

export default function Home() {
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const startSession = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kioskId: 'kiosk-1', language: 'en' }),
      });
      const data = await res.json();
      setState(data.state);
      setStarted(true);

      // Send first message to get Relay's greeting
      const msgRes = await fetch(`${API_URL}/api/sessions/${data.sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Hello',
          state: data.state,
        }),
      });
      const msgData = await msgRes.json();
      setMessages([{ role: 'relay', text: msgData.response }]);
      setState(msgData.state);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'customer', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/sessions/${state.sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userText, state }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'relay', text: data.response }]);
      setState(data.state);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (!started) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f3460 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '13px', letterSpacing: '4px', opacity: 0.5, marginBottom: '24px' }}>
            NEWROADS MAZDA
          </div>
          <h1 style={{ fontSize: '80px', fontWeight: '700', margin: '0 0 8px', letterSpacing: '-3px' }}>
            Relay
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.6, marginBottom: '60px', fontWeight: '300' }}>
            Your personal automotive guide
          </p>
          <button
            onClick={startSession}
            disabled={loading}
            style={{
              background: 'white',
              color: '#0a0a0a',
              border: 'none',
              padding: '18px 64px',
              borderRadius: '50px',
              fontSize: '17px',
              fontWeight: '600',
              cursor: 'pointer',
              letterSpacing: '0.5px',
            }}>
            {loading ? 'Starting...' : 'Begin'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      color: 'white',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>Relay</div>
        <div style={{ fontSize: '12px', opacity: 0.4, letterSpacing: '2px' }}>
          {state?.currentStage}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.4 }}>NewRoads Mazda</div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'customer' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '65%',
              padding: '14px 20px',
              borderRadius: msg.role === 'customer' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              background: msg.role === 'customer' ? '#0f3460' : 'rgba(255,255,255,0.08)',
              fontSize: '16px',
              lineHeight: '1.5',
              color: 'white',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '14px 20px',
              borderRadius: '20px 20px 20px 4px',
              background: 'rgba(255,255,255,0.08)',
              fontSize: '16px',
              opacity: 0.5,
            }}>
              Relay is thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '20px 32px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        gap: '12px',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '50px',
            padding: '14px 24px',
            color: 'white',
            fontSize: '16px',
            outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{
            background: 'white',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: '50px',
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
          }}>
          Send
        </button>
      </div>
    </div>
  );
}