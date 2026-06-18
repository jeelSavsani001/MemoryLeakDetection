import { useRouter } from 'next/router';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const DynamicSafeChild = dynamic(
    () => import(/* webpackChunkName: "safe-child" */ '../../components/SafeChild'),
    {loading: () => <p>Loading safe child...</p>},
);

const DynamicLeakyChild = dynamic(
    () => import(/* webpackChunkName: "leaky-child" */ '../../components/LeakyChild'),
    {loading: () => <p>Loading leaky child...</p>},
);

const GET_CHARACTER_DETAILS = gql`
    query GetCharacterDetails($id: ID!) {
        character(id: $id) {
            id
            name
            status
            species
            gender
        }
    }
`;

export default function DetailsPage() {
    const [leak, setLeak] = useState(0);

    useEffect(() => {
        // cause a leak

        const hugePayload = new Array(500000).fill('--hahahahhahahha--').join('');
        const onResize = () => {
            console.log("reference the payload inside the lexical context", hugePayload.substring(0, 10));
            setLeak(prev => prev + 1);
        };
        window.addEventListener('resize', onResize);
        // const onTimer = () => {
        //     console.log("reference the payload inside the lexical context", hugePayload.substring(0, 10));
        // };
        // const timerId = setInterval(onTimer, 16000);
        // return () => {
        //     window.removeEventListener('resize', onResize);
        // };
    }, []);
 
    const router = useRouter();
    const { id } = router.query;

    const [activeTab, setActiveTab] = useState(null);

    const { loading, error, data } = useQuery(GET_CHARACTER_DETAILS, {
        variables: { id },
        skip: !id, // Skip the query until we have an ID
    });

    if (loading) return <p>Loading character details...</p>;
    if (error) return <p>Error loading character details!</p>;
    if (!data || !data.character) return <p>No character data available.</p>;

    return (
        <div data-testid="character-details" style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
                <h1>{data.character.name}</h1>
                <p><strong>Status:</strong> {data.character.status}</p>
                <p><strong>Species:</strong> {data.character.species}</p>
                <p><strong>Gender:</strong> {data.character.gender}</p>
            </div>

            <hr style={{ margin: '40px 0' }} />

            <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h2 style={{ marginTop: 0 }}>Memory Leak Test Harness</h2>
                <p>Use these buttons to trigger Webpack dynamic imports.</p>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button 
                        data-testid="mount-safe-btn"
                        onClick={() => setActiveTab('safe')} 
                        style={{ padding: '10px 15px', cursor: 'pointer' }}
                    >
                        Mount Safe Child
                    </button>
                    <button 
                        data-testid="mount-leaky-btn"
                        onClick={() => setActiveTab('leaky')} 
                        style={{ padding: '10px 15px', cursor: 'pointer' }}
                    >
                        Mount Leaky Child
                    </button>
                    <button 
                        data-testid="unmount-both-btn"
                        onClick={() => setActiveTab(null)} 
                        style={{ padding: '10px 15px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Unmount Both (Trigger Leak)
                    </button>
                    <button 
                        data-testid="go-to-status-btn"
                        onClick={() => router.push(`/status?from=${id}`)} 
                        style={{ padding: '10px 15px', cursor: 'pointer', backgroundColor: '#e0e0e0', border: '1px solid #ccc' }}
                    >
                        Go to Status Page
                    </button>
                    <button 
                        data-testid="back-to-home-btn"
                        onClick={() => router.push('/')}
                        style={{ padding: '10px 15px', cursor: 'pointer' }}
                    >
                        Go back to Home page
                    </button>
                </div>

                <div style={{ marginTop: '20px', minHeight: '150px' }}>
                    {activeTab === 'safe' && <DynamicSafeChild />}
                    {activeTab === 'leaky' && <DynamicLeakyChild />}
                    {activeTab === null && <p style={{ color: 'gray' }}>No child components mounted.</p>}
                </div>
            </div>
        </div>
    );
}
DetailsPage.displayName = 'DetailsPage';
