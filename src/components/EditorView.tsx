import React, { useEffect, useRef, useState } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import type * as MonacoEditor from 'monaco-editor'
import WSClient from '../services/wsClient'
import { getDocument } from '../services/api'
import type { Operation } from '../types'
import { simpleDiff } from '../utils/diff'
import { Console } from 'console'
import getGlobalWS from '../services/wsClient'

const LANGUAGES = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'json', label: 'JSON' },
    { id: 'python', label: 'Python' },
]

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
    let t: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
        if (t) clearTimeout(t)
        t = setTimeout(() => fn(...args), wait)
    }
}

export default function EditorView({ id, initialLanguage }: { id: string; initialLanguage?: string }) {
    const [content, setContent] = useState<string>('')
    const [language, setLanguage] = useState<string>(initialLanguage || 'javascript')
    const [title, setTitle] = useState<string>('')
    const wsRef = useRef<ReturnType<typeof getGlobalWS> | null>(null);
    const monacoRef = useRef<Monaco | null>(null)
    type EditorInstance = MonacoEditor.editor.IStandaloneCodeEditor
    const editorRef = useRef<EditorInstance | null>(null)
    const WS_URL = import.meta.env.VITE_BACKEND_WS
        ? `${import.meta.env.VITE_BACKEND_WS}/${id}`
        : `ws://localhost:8080/ws/${id}`;
    const contentRef = useRef(content);

    useEffect(() => {
        contentRef.current = content; // keep ref in sync
    }, [content]);



    useEffect(() => {
        let mounted = true;

        // Get the singleton WS client
        const ws = getGlobalWS(WS_URL);
        wsRef.current = ws;

        // Attach message handler
        ws.onMessage = (msg) => {
            if (!msg || !mounted) return;
            console.log("received msg")
            switch (msg.type) {
                case "snapshot": {
                    // Backend sent full document state
                    console.log("received snapshot")
                    if (typeof msg.content === "string") setContent(msg.content);
                    if (msg.type === "snapshot") {
                        if (msg.title === "string") {
                            setTitle(msg.title);
                        }
                        if (msg.language === "string") {
                            setLanguage(msg.language);
                        }
                    }

                    break;
                }
                case "update": {
                    // Operational updates from other users
                    if (msg.id === id && typeof msg.content === "string") {
                        setContent(msg.content);
                    }
                    break;
                }
                case "user_joined":
                case "user_left":
                    // handle presence updates if needed
                    break;
            }
        };

        // Attach onOpen handler — send init handshake after component is ready
        ws.onOpen = () => {
            console.log("WS open — sending init handshake");

            // Delay zero to let React fully wire state/handlers
            setTimeout(() => {
                ws.sendReady({ type: "init", id, username: "Anonymous" });
            }, 0);
        };

        // Attach onClose/error handlers for debugging
        ws.onClose = (ev) => console.log("WS closed", ev.code, ev.reason);
        ws.onError = (ev) => console.log("WS error", ev);

        // Connect (or reuse singleton)
        ws.connect();

        return () => {
            mounted = false;

            // Optionally disconnect (singleton allows you to keep connection across HMR)
            ws.disconnect();
            wsRef.current = null;
        };
    }, [id]);




    // When the language state changes and Monaco has mounted, apply the language to the model.
    useEffect(() => {
        const monaco = monacoRef.current
        const editor = editorRef.current
        if (!monaco || !editor) return
        const model = editor.getModel() as MonacoEditor.editor.ITextModel | null
        if (model) monaco.editor.setModelLanguage(model, language)
    }, [language, monacoRef.current, editorRef.current])

    // // Debounced sender for document metadata updates
    // const sendDocUpdate = useRef(
    //     debounce((lang?: string | null, titleVal?: string | null) => {
    //         const ws = wsRef.current
    //         if (!ws) return
    //         ws.sendDocumentUpdate(id, { language: lang ?? null, title: titleVal ?? null })
    //     }, 300)
    // )

    // For metadata (title/lang) updates
    const sendMetadataUpdate = useRef(
        debounce((lang?: string | null, titleVal?: string | null) => {
            console.log(language)
            console.log(title)
            wsRef.current?.sendDocumentUpdate(id, {
                language: lang,
                title: titleVal
            })
        }, 300)
    )

    // For snapshot persistence (full document save)
    const sendSnapshotUpdate = useRef(
        debounce(() => {
            wsRef.current?.sendSnapshotUpdate(id, {
                content: contentRef.current
            })
        }, 5000) // every ~5s of idle time
    )

    function handleTitleChange(title: string) {
        setTitle(title)
        sendMetadataUpdate.current(language, title)
    }

    // function flushChanges() {
    //     console.log("IN FLUSHER")
    //     sendDocUpdate
    // }


    function handleChange(value?: string) {
        console.log("HANDLING CHANGE")
        const newContent = value || ''
        const oldContent = content
        setContent(newContent)
        console.log(content)

        // compute diffs using local simpleDiff and emit Operation messages
        const diffs = simpleDiff(oldContent, newContent)
        let cursor = 0
        const clientId = getClientId()
        for (const [kind, txt] of diffs) {
            if (kind === '=') {
                cursor += txt.length
                continue
            }
            if (kind === '-') {
                const op: Operation = {
                    type: 'delete',
                    position: cursor,
                    length: txt.length,
                    content: txt,
                    client_id: clientId,
                    timestamp: Date.now()
                }
                wsRef.current?.sendOperation(id, op)
                continue
            }
            if (kind === '+') {
                const op: Operation = {
                    type: 'insert',
                    position: cursor,
                    length: txt.length,
                    content: txt,
                    client_id: clientId,
                    timestamp: Date.now()
                }
                wsRef.current?.sendOperation(id, op)
                cursor += txt.length
                continue
            }
        }
        // also send the content as a document_update after debounce (so backend can persist snapshot)
        sendSnapshotUpdate.current() // content already being sent via operations; optional snapshot
    }

    function handleEditorMount(editor: EditorInstance, monaco: Monaco): void {
        console.log("editor mount")
        //flushChanges()
        editorRef.current = editor
        monacoRef.current = monaco
        const model = editor.getModel() as MonacoEditor.editor.ITextModel | null
        if (model) monaco.editor.setModelLanguage(model, language)
    }

    function changeLanguage(lang: string): void {
        setLanguage(lang)
        const monaco = monacoRef.current
        const editor = editorRef.current
        if (monaco && editor) {
            const model = editor.getModel() as MonacoEditor.editor.ITextModel | null
            if (model) monaco.editor.setModelLanguage(model, lang)
        }
        // send debounced document language update
        sendMetadataUpdate.current(lang, title)
    }

    async function formatContent(): Promise<void> {
        const editor = editorRef.current
        const monaco = monacoRef.current
        if (!editor || !monaco) return

        // Try Monaco's built-in formatting action first
        try {
            const action = editor.getAction('editor.action.formatDocument')
            if (action) {
                // run may return void or a Promise
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                action.run()
            }
        } catch (err) {
            // keep the error typed as unknown
            console.warn('monaco format failed', err)
        }
    }

    return (
        <div className="editor-root" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 12, color: '#666' }}>Title</div>
                        <div>
                            <input value={title || 'Untitled'} onChange={(e) => handleTitleChange(e.target.value)} style={{ fontSize: 16, fontWeight: 600, border: 'none', background: 'transparent' }} />
                        </div>
                    </div>
                    <label style={{ fontSize: 13 }}>Language:</label>
                    <select value={language} onChange={(e) => changeLanguage(e.target.value)}>
                        {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                    <button onClick={formatContent}>Format</button>
                </div>
            </div>
            <div style={{ flex: 1 }}>
                <Editor
                    height="100%"
                    language={language}
                    value={content}
                    onChange={handleChange}
                    onMount={handleEditorMount}
                    options={{ automaticLayout: true }}
                />
            </div>
        </div>
    )
}

function getClientId(): string {
    // simple client id stored in localStorage
    const key = 'collab_client_id'
    let id = localStorage.getItem(key)
    if (!id) {
        id = cryptoRandomId()
        localStorage.setItem(key, id)
    }
    return id
}

function cryptoRandomId(): string {
    // small helper to create a short random id
    try {
        return Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (e) {
        // fallback
        return Math.random().toString(36).slice(2, 10)
    }
}
