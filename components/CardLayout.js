export default function CardLayout({id, name, onCardClick}) {
    return (
        <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '16px', margin: '8px', maxWidth: '300px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0 }}>{name}</h3>
            <button 
                onClick={() => onCardClick(id)} 
                style={{ cursor: 'pointer', padding: '8px 16px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px' }}
            >
                Details
            </button>
        </div>
    );
}