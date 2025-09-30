import React, { useEffect, useState } from 'react'
import { listDocuments, createDocument, deleteDocument, getDocument } from './services/api'
import DocumentList from './components/DocumentList'
import EditorView from './components/EditorView'

const LANGUAGES = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'json', label: 'JSON' },
    { id: 'python', label: 'Python' },
]

export default function App() {
    const [docs, setDocs] = useState<Array<{ id: string; title: string; language?: string }>>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [activeLanguage, setActiveLanguage] = useState<string | undefined>(undefined)
    const [showCreate, setShowCreate] = useState(false)
    const [newTitle, setNewTitle] = useState('Untitled')
    const [newLang, setNewLang] = useState('javascript')

    useEffect(() => {
        fetchDocs()
    }, [])

    async function fetchDocs() {
        const data = await listDocuments()
        setDocs(data || [])
    }

    async function handleCreate() {
        // Optimistic UI: insert a temporary doc immediately so the user sees it.
        const tempId = `temp-${Date.now()}`
        const tempDoc = { id: tempId, title: newTitle, language: newLang }

        setDocs(prev => [tempDoc, ...prev])
        setActiveId(tempId)
        setActiveLanguage(newLang)
        setShowCreate(false)

        try {
            const doc = await createDocument({ title: newTitle, content: '', language: newLang })
            // Replace the temporary doc with the server's returned document
            setDocs(prev => [doc, ...prev.filter(d => d.id !== tempId)])
            setActiveId(doc.id)
            setActiveLanguage(doc.language || newLang)
        } catch (err) {
            console.error('Failed to create document:', err)
            setDocs(prev => prev.filter(d => d.id !== tempId))
            setActiveId(null)
            setActiveLanguage(undefined)
            alert('Failed to create document. Check the backend or network and try again.')
        }
    }

    async function handleDelete(id: string) {
        await deleteDocument(id)
        if (activeId === id) setActiveId(null)
        await fetchDocs()
    }

    function handleOpen(id: string) {
        const doc = docs.find(d => d.id === id)
        setActiveId(id)
        setActiveLanguage(doc?.language)
    }

    return (
        <div className="app">
            <aside className="sidebar">
                <h2>Documents</h2>
                <button onClick={() => setShowCreate(true)}>New</button>
                {showCreate && (
                    <div style={{ padding: 8, border: '1px solid #ddd', marginTop: 8, borderRadius: 4 }}>
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ display: 'block', fontSize: 13 }}>Title</label>
                            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ display: 'block', fontSize: 13 }}>Language</label>
                            <select value={newLang} onChange={(e) => setNewLang(e.target.value)}>
                                {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={handleCreate}>Create</button>
                            <button onClick={() => setShowCreate(false)}>Cancel</button>
                        </div>
                    </div>
                )}

                <DocumentList docs={docs} onOpen={handleOpen} onDelete={handleDelete} />
            </aside>
            <main className="editor">
                {activeId ? <EditorView id={activeId} initialLanguage={activeLanguage} /> : <div className="placeholder">Open a document to edit</div>}
            </main>
        </div>
    )
}
