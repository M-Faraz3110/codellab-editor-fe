import React from 'react'

export default function DocumentList({ docs, onOpen, onDelete }: { docs: Array<{ id: string, title: string }>, onOpen: (id: string) => void, onDelete: (id: string) => void }) {
    return (
        <ul className="doc-list">
            {docs.map(d => (
                <li key={d.id}>
                    <button className="link" onClick={() => onOpen(d.id)}>{d.title || d.id}</button>
                    <button className="danger" onClick={() => onDelete(d.id)}>Delete</button>
                </li>
            ))}
        </ul>
    )
}
