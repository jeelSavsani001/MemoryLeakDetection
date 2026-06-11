import { useEffect, useState } from 'react';

export default function LeakyChild() {
  const [leakCount, setLeakCount] = useState(0);

  useEffect(() => {
    // 1. Create a massive payload
    const massivePayload = new Array(500000).fill('--leaky-child-data--').join('');
    
    // 2. Trap it inside a closure
    const onResize = () => {
      console.log("Trapped in the child chunk:", massivePayload.substring(0, 10));
      setLeakCount(prev => prev + 1);
    };

    // 3. Mount it to the global Window without a cleanup function
    window.addEventListener('resize', onResize);

    // INTENTIONAL LEAK: No return () => window.removeEventListener(...)
  }, []);

  return (
    <div data-testid="leaky-child" style={{ padding: '20px', border: '2px solid red', marginTop: '20px' }}>
      <h2>🚨 Leaky Component</h2>
      <p>I am secretly hoarding memory.</p>
    </div>
  );
}
LeakyChild.displayName = 'LeakyChild';
