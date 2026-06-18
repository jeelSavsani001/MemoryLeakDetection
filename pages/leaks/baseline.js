import { useRouter } from 'next/router';

export default function BaselinePage() {

    const router = useRouter();

    function handleCollectionPageClick() {
        router.push('/leaks/collection');
    }

    return (
        <div data-testid="baseline-page" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button data-testid="collection-page-btn" onClick={handleCollectionPageClick}>Collection Page</button>
        </div>
    );
}