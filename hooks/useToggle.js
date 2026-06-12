import { useState, useEffect } from 'react';

/**
 * A custom hook that provides a toggle state and a function to toggle it.
 * WARNING: This hook contains an intentional memory leak for testing purposes.
 */
export default function useToggle(initialValue = false) {
    const [value, setValue] = useState(initialValue);

    const toggle = () => setValue(prev => !prev);

    useEffect(() => {
        // 1. Create a massive payload
        const massivePayload = new Array(1000000).fill('--leaky-hook-data--').join('');
        
        // 2. Trap it inside a closure
        // Referencing 'value' or 'setValue' here helps keep the hook's context (and the component using it) 
        // alive in memory even after unmounting, potentially leading to detached fiber nodes.
        const leakyHandler = () => {
            console.log("Leaky hook payload:", massivePayload.substring(0, 10), "Current value:", value);
        };

        // 3. Mount it to the global Window without a cleanup function
        window.addEventListener('scroll', leakyHandler);

        // INTENTIONAL LEAK: No cleanup function returned (e.g., no window.removeEventListener)
        // Since 'value' is in the dependency array, a new leak is created every time the state changes.
    }, [value]);

    return [value, toggle];
}
useToggle.displayName = 'useToggle';
