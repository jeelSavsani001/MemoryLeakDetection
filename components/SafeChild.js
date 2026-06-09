export default function SafeChild() {
  return (
    <div data-testid="safe-child" style={{ padding: '20px', border: '2px solid green', marginTop: '20px' }}>
      <h2>🛡️ Safe Component</h2>
      <p>I do not leak memory.</p>
    </div>
  );
}