export default function Home() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <h1 style={{ fontSize: '72px', fontWeight: 'bold', marginBottom: '16px', letterSpacing: '-2px' }}>
          Relay
        </h1>
        <p style={{ fontSize: '20px', marginBottom: '48px', opacity: 0.7 }}>
          Your Automotive Intelligence Agent
        </p>
        <button style={{
          background: 'white',
          color: '#0f3460',
          border: 'none',
          padding: '16px 48px',
          borderRadius: '50px',
          fontSize: '18px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}>
          Begin
        </button>
      </div>
    </div>
  );
}