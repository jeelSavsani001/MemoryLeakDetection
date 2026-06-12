import { useRouter } from 'next/router';
import useToggle from '../hooks/useToggle';

export default function StatusPage() {
    const router = useRouter();
    const { from } = router.query;
    const [isOpen, toggleMenu] = useToggle(false);

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100vh', 
            fontFamily: 'sans-serif' 
        }}>
            <h1>Everything is working good, no Leaks</h1>
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
                <button 
                    data-testid="back-to-details-btn"
                    onClick={() => router.push(`/details/${from}`)}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}
                >
                    Go back to Details page
                </button>
                <button 
                    data-testid="back-to-home-btn"
                    onClick={() => router.push('/')}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}
                >
                    Go back to Home page
                </button>
                <button
                    data-testid="toggle-btn"
                    onClick = {toggleMenu}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}
                >
                    {isOpen ? 'Unmount' : 'Mount'}
                </button>
            </div>
            {isOpen && <p>Data Mounted</p>}
        </div>
    );
}
StatusPage.displayName = 'StatusPage';
