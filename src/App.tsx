import React, { useEffect, useState } from 'react'
import { listDocuments, createDocument, deleteDocument, getDocument } from './services/api'
import DocumentList from './components/DocumentList'
import EditorView from './components/EditorView'
import { NewDocumentView } from './components/NewDocumentView'
import { Document } from './types'

const LANGUAGES = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'json', label: 'JSON' },
    { id: 'python', label: 'Python' },
    { id: 'text', label: 'Text' }
]

export default function App() {
    const [docs, setDocs] = useState<Array<{ id: string; title: string; language?: string }>>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [activeLanguage, setActiveLanguage] = useState<string | undefined>(undefined)
    const [showCreate, setShowCreate] = useState(false)
    const [newTitle, setNewTitle] = useState('Untitled')
    const [newLang, setNewLang] = useState('javascript')
    //const [activeDoc, setActiveDoc] = useState<any | null>(null)
    const url = new URL(window.location.href)
    const idFromUrl = url.searchParams.get('id')

    useEffect(() => {
        const url = new URL(window.location.href)
        const id = url.searchParams.get('id')
        if (id) {
            setActiveId(id)  // triggers EditorView mount
            replaceIdInUrl(id)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function replaceIdInUrl(id: string | null) {
        const url = new URL(window.location.href)
        if (id) {
            url.searchParams.set('id', id)
        }
        // update the URL without reloading the page
        window.history.replaceState(null, '', url.toString())
    }

    // async function handleShare() {
    //     if (!activeDoc) return
    //     const url = window.location.href // already contains ?id=...
    //     // prefer Web Share API when available (mobile)
    //     if ((navigator as any).share) {
    //         try {
    //             await (navigator as any).share({ title: activeDoc.title || 'Code document', url })
    //             return
    //         } catch (err) {
    //             // fallthrough to clipboard method on failure
    //             console.warn('Web share failed, copying to clipboard', err)
    //         }
    //     }

    //     // fallback: copy link to clipboard
    //     try {
    //         await navigator.clipboard.writeText(url)
    //         // simple user feedback — replace with your toast if you have one
    //         alert('Document link copied to clipboard!')
    //     } catch (err) {
    //         console.error('Clipboard write failed', err)
    //         alert('Unable to copy link automatically. Please copy the URL from your address bar.')
    //     }
    // }

    // useEffect(() => {
    //     fetchDocs()
    // }, [])

    async function fetchDocs() {
        const data = await listDocuments()
        setDocs(data || [])
    }

    async function handleCreate(doc: Document) {
        // Optimistic UI: insert a temporary doc immediately so the user sees it.
        const tempId = `temp-${Date.now()}`
        const tempDoc = { id: tempId, title: newTitle, language: newLang }

        setDocs(prev => [tempDoc, ...prev])
        setActiveId(tempId)
        setActiveLanguage(newLang)
        setShowCreate(false)

        try {
            //const doc = await createDocument({ title: newTitle, content: '', language: newLang })
            // Replace the temporary doc with the server's returned document
            setDocs(prev => [doc, ...prev.filter(d => d.id !== tempId)])
            setActiveId(doc.id)
            console.log("doc language " + doc.language)
            setActiveLanguage(doc.language || newLang)
        } catch (err) {
            console.error('Failed to create document:', err)
            setDocs(prev => prev.filter(d => d.id !== tempId))
            setActiveId(null)
            setActiveLanguage(undefined)
            alert('Failed to create document. Check the backend or network and try again.')
        }
    }

    // async function handleDelete(id: string) {
    //     await deleteDocument(id)
    //     if (activeId === id) setActiveId(null)
    //     await fetchDocs()
    // }

    // function handleOpen(id: string) {
    //     const doc = docs.find(d => d.id === id)
    //     console.log("current active id: " + id)
    //     setActiveId(id)
    //     setActiveLanguage(doc?.language)
    // }

    // If there’s an id in the URL, show editor; otherwise show creation form
    if (idFromUrl) {
        <EditorView id={idFromUrl} initialContent={''} initialLanguage={activeLanguage} />
    }


    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',    // fill viewport height
                width: '100vw',     // fill viewport width
            }}
        >
            {idFromUrl ? (
                <div style={{ flex: 1, minHeight: 0 }}>
                    <EditorView id={idFromUrl} initialContent={''} initialLanguage={activeLanguage} />
                </div>
            ) : (
                <NewDocumentView onCreated={handleCreate} />
            )}
        </div>
    )
}
