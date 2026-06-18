import { useEffect, useState } from 'react';

// Module-scoped cache. In a Next.js SPA the module stays loaded across client
// navigations, so this Map grows every time the page mounts -- an unbounded
// collection leak with no eviction. Fixture for collection_growth_leak_filter.
const visitCache = new Map();

export default function CollectionLeakPage() {
  const [size, setSize] = useState(0);

  useEffect(() => {
    const key = `visit-${Date.now()}-${Math.random()}`;
    visitCache.set(key, new Array(20000).fill('collection-leak-entry'));
    setSize(visitCache.size);
  }, []);

  return (
    <div data-testid="collection-leak" style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Collection Growth Leak</h1>
      <p>This page appends a large entry to a module-level Map on every mount.</p>
      <p>
        Cache entries so far: <strong data-testid="cache-size">{size}</strong>
      </p>
      <p>Navigate away and back repeatedly to grow it, then snapshot.</p>
    </div>
  );
}
