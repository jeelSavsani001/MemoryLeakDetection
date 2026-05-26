import Card from "../components/CardLayout";
import { useRouter } from "next/router";
import { useState, useEffect } from 'react';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// Define the GraphQL Query
const GET_CHARACTERS = gql`
    query GetCharacters($page: Int!) {
        characters(page: $page) {
            info {
                next
                prev
                pages
            }
            results {
                id
                name
            }
        }
    }
`;

// 3. Create a component that uses the query
export default function CharacterList() {
    const router = useRouter();
    
    // Check if there is a 'page' query parameter in the URL, otherwise default to 1.
    const initialPage = parseInt(router.query.page) || 1;
    const [page, setPage] = useState(initialPage);

    // Sync state when URL query parameter changes (like back/forward navigation)
    useEffect(() => {
        if (router.isReady) {
            setPage(parseInt(router.query.page) || 1);
        }
    }, [router.isReady, router.query.page]);

    // Sync the URL when the page state changes
    const handlePageChange = (newPage) => {
        setPage(newPage);
        router.push(`/?page=${newPage}`, undefined, { shallow: true });
    };

    const { loading, error, data } = useQuery(GET_CHARACTERS, {
        variables: { page }
    });

    if (loading) return <p>Loading characters...</p>;
    if (error) return <p>Error loading characters!</p>;
    
    // Destructure info and results from our query
    const { info, results } = data.characters;

    return (
        <div>
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '16px',
            }}>
                {results.map((item) => {
                    return (
                        <Card
                            key={item.id}
                            id={item.id}
                            name={item.name}
                            onCardClick={(id) => {
                                router.push(`/details/${id}`);
                            }}
                        />
                    )
                })}
            </div>
            
            {/* Pagination Controls */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '20px', 
                margin: '30px 0' 
            }}>
                <button 
                    disabled={!info.prev} 
                    onClick={() => handlePageChange(page - 1)}
                    style={{ 
                        padding: '8px 16px', 
                        cursor: info.prev ? 'pointer' : 'not-allowed' 
                    }}
                >
                    Previous
                </button>
                <span>Page {page} of {info.pages}</span>
                <button 
                    disabled={!info.next} 
                    onClick={() => handlePageChange(page + 1)}
                    style={{ 
                        padding: '8px 16px', 
                        cursor: info.next ? 'pointer' : 'not-allowed' 
                    }}
                >
                    Next
                </button>
            </div>
        </div>
    );
}