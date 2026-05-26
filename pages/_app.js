import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';

// Initialize the Apollo Client globally
const link = new HttpLink({ uri: 'https://rickandmortyapi.com/graphql' });
const client = new ApolloClient({
    link,
    cache: new InMemoryCache()
});

export default function MyApp({ Component, pageProps }) {
    return (
        <ApolloProvider client={client}>
            <Component {...pageProps} />
        </ApolloProvider>
    );
}