import { useRouter } from 'next/router';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { useState, useEffect } from 'react';

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
    }, []);
 
    const router = useRouter();
    const { id } = router.query;

    const { loading, error, data } = useQuery(GET_CHARACTER_DETAILS, {
        variables: { id },
        skip: !id, // Skip the query until we have an ID
    });

    if (loading) return <p>Loading character details...</p>;
    if (error) return <p>Error loading character details!</p>;
    if (!data || !data.character) return <p>No character data available.</p>;

    return (
        <div data-testid="character-details" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>{data.character.name}</h1>
            <p><strong>Status:</strong> {data.character.status}</p>
            <p><strong>Species:</strong> {data.character.species}</p>
            <p><strong>Gender:</strong> {data.character.gender}</p>
        </div>
    );
}
