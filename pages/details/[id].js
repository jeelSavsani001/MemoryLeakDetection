import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

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

// 🚨 NEW LEAKY COMPONENT
function HeavyLeaker({ name }) {
    useEffect(() => {
        // 1. Global reference leak
        window._leaked_components = window._leaked_components || [];
        window._leaked_components.push({
            name,
            timestamp: Date.now(),
            // Capturing 'name' in this closure keeps the FiberNode 
            // of HeavyLeaker reachable in many React versions/environments.
            log: () => console.log("Leaked HeavyLeaker for:", name)
        });

        // 2. Interval leak
        const intervalId = setInterval(() => {
            console.log("Still leaking HeavyLeaker:", name);
        }, 10000);

        // ❌ NO CLEANUP
    }, [name]);

    return <div style={{ color: 'red', marginTop: '10px' }}>⚠️ HeavyLeaker Active for {name}</div>;
}

export default function DetailsPage() {

    //
    const router = useRouter();
    const { id } = router.query;

    const { loading, error, data } = useQuery(GET_CHARACTER_DETAILS, {
        variables: { id },
        skip: !id, // Skip the query until we have an ID
    });


    // 🚨 LEAK: Event listener + stale closure
    useEffect(() => {
        if (!data?.character) return;

        const character = data.character;

        const onResize = () => {
            // This closure keeps reference to "character"
            console.log("Leaked character:", character.name);
        };

        window.addEventListener('resize', onResize);

        // ❌ NO CLEANUP → listener persists after unmount
    }, [data]);


    if (loading) return <p>Loading character details...</p>;
    if (error) return <p>Error loading character details!</p>;

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>{data.character.name}</h1>
            <p><strong>Status:</strong> {data.character.status}</p>
            <p><strong>Species:</strong> {data.character.species}</p>
            <p><strong>Gender:</strong> {data.character.gender}</p>

            <HeavyLeaker name={data.character.name} />
        </div>
    );
}


/* Type of Memory leaks that can be introduced in [id].js
    1) Global variable : 
    -> code: 
        let cachedCharacterData = null;

        export default function DetailsPage() {
            const router = useRouter();
            const { id } = router.query;

            const { loading, error, data } = useQuery(GET_CHARACTER_DETAILS, {
                variables: { id },
                skip: !id,
            });

            // Store the data globally - it never gets released
            if (data?.character) {
                cachedCharacterData = data.character; // LEAK: Holds reference even after unmount
            }

            // ... rest of component
        }

    2) SetInterval without cleanup:
    -> code:
        useEffect(() => {
            const characterData = data?.character;
            
            // Start an interval that references character data
            const intervalId = setInterval(() => {
                console.log("Character status update check:", characterData?.status);
            }, 5000);
            
            // MISSING: return () => clearInterval(intervalId);
            // Result: Interval keeps running even after page unmount
        }, [data]);
    
    -> This feature can be used in future to keep updating the data 

    3) Caching large data in memory:
    -> code:
        // Module-level cache that grows
        const characterCache = {};

        export default function DetailsPage() {
            const router = useRouter();
            const { id } = router.query;

            const { loading, error, data } = useQuery(GET_CHARACTER_DETAILS, {
                variables: { id },
                skip: !id,
            });

            if (data?.character) {
                // Create heavy copy and store forever
                characterCache[id] = {
                    ...data.character,
                    episodes: new Array(100000).fill("episode data"), // Simulate heavy data
                };
            }

            // ... render
        }
*/
