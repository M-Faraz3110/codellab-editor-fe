import React, { useEffect, useRef, useState } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import type * as MonacoEditor from 'monaco-editor'
import WSClient from '../services/wsClient'
import { getDocument } from '../services/api'
import type { Operation, WSMessage } from '../types'
import { simpleDiff } from '../utils/diff'
import { Console } from 'console'
import getGlobalWS from '../services/wsClient'

const LANGUAGES = [
    { id: 'javascript', label: 'JavaScript' },
    { id: 'typescript', label: 'TypeScript' },
    { id: 'json', label: 'JSON' },
    { id: 'python', label: 'Python' },
    { id: 'text', label: 'Text' }
]

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
    let t: ReturnType<typeof setTimeout> | null = null
    return (...args: Parameters<T>) => {
        if (t) clearTimeout(t)
        t = setTimeout(() => fn(...args), wait)
    }
}

export default function EditorView({ id, initialContent, initialLanguage }: { id: string; initialContent?: string; initialLanguage?: string }) {
    const [content, setContent] = useState<string>('')
    const [language, setLanguage] = useState<string>(initialLanguage || 'javascript')
    const [title, setTitle] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(true)
    const [connected, setConnected] = useState<boolean>(false)
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
        const monaco = monacoRef.current;
        const editor = editorRef.current;
        if (!monaco || !editor) return;

        const model = editor.getModel();
        if (model) monaco.editor.setModelLanguage(model, language);
    }, [language]);

    // Sync local content state when the prop changes
    useEffect(() => {
        if (initialContent !== undefined) {
            setContent(initialContent)
        }
    }, [initialContent])

    const debouncedFormat = debounce(() => formatContent(), 1000);

    useEffect(() => {
        setLoading(true)
        let mounted = true;

        // Get the singleton WS client
        const ws = getGlobalWS(WS_URL);
        wsRef.current = ws;

        // Attach message handler
        ws.onMessage = (msg: WSMessage) => {
            if (!msg || !mounted) return;
            switch (msg.type) {
                case "snapshot": {
                    // Backend sent full document state
                    console.log("received snapshot")
                    setLoading(false)
                    setConnected(true)
                    console.log("content: " + typeof msg.content)
                    if (typeof msg.content === "string") {
                        console.log("received" + msg.content)
                        setContent(msg.content);
                    }
                    if (typeof msg.title === "string") {
                        setTitle(msg.title);
                    }
                    if (typeof msg.language === "string" && msg.language != "") {
                        console.log("change lang" + msg.language)
                        setLanguage(msg.language);
                    }

                    break;
                }
                case "operation": {
                    console.log('operation received')
                    if (msg.operation) {
                        const op: Operation = msg.operation;
                        setContent(prev => applyOperation(prev, op))
                    }
                    break;
                }
                case "document_update": {
                    // Operational updates from other users
                    // if (msg.id === id && typeof msg.content === "string") {
                    //     setContent(msg.content);
                    // }
                    break;
                }
                    // case "user_joined":
                    // case "user_left":
                    // handle presence updates if needed
                    break;
            }
        };

        // Attach onOpen handler — send init handshake after component is ready
        ws.onOpen = () => {
            setConnected(true)
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




    // // When the language state changes and Monaco has mounted, apply the language to the model.
    // useEffect(() => {
    //     const monaco = monacoRef.current
    //     const editor = editorRef.current
    //     if (!monaco || !editor) return
    //     const model = editor.getModel() as MonacoEditor.editor.ITextModel | null
    //     if (model) monaco.editor.setModelLanguage(model, language)
    // }, [language, monacoRef.current, editorRef.current])

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

    // function handleTitleChange(title: string) {
    //     setTitle(title)
    //     sendMetadataUpdate.current(language, title)
    // }

    function applyOperation(doc: string, op: Operation): string {
        switch (op.type) {
            case "insert":
                return (
                    doc.slice(0, op.position) +
                    op.content +
                    doc.slice(op.position)
                );

            case "delete":
                if (op.length) {
                    return (
                        doc.slice(0, op.position) +
                        doc.slice(op.position + op.length)
                    );
                }
            case "retain":
                // retain means "no change", just keep doc
                return doc;

            default:
                console.warn("Unknown op type:", op.type);
                return doc;
        }
    }

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
        debouncedFormat()
        sendSnapshotUpdate.current() // this syncs up the db 
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

    const handleShare = async () => {
        const url = new URL(window.location.href)
        url.searchParams.set("id", id)
        const href = url.toString()
        // if ((navigator as any).share) {
        //     try {
        //         await (navigator as any).share({ title: title ?? "Code document", url: href })
        //         return
        //     } catch (err) {
        //         // fall back to clipboard
        //     }
        // }
        try {
            await navigator.clipboard.writeText(href)
            // small visual feedback
            // you may replace alert with your toast if you have one
            alert("Link copied to clipboard!")
        } catch (err) {
            // fallback: show URL in prompt for manual copy
            // eslint-disable-next-line no-alert
            window.prompt("Copy link to share:", href)
        }
    }

    if (loading) {
        return (
            <div style={outerContainerStyle}>
                <div style={headerStyle}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={logoStyle}>CL</div>
                        <div>
                            <div style={{ color: "#61dafb", fontSize: 20, fontWeight: 700 }}>[PLACEHOLDER]</div>
                            <div style={{ color: "#9cdcfe", fontSize: 12 }}>{language ?? "loading…"}</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ color: connected ? "#9fe0a6" : "#f6c85f", fontSize: 13 }}>
                            {connected ? "connected" : "connecting..."}
                        </div>
                        <button onClick={handleShare} style={shareButtonStyle}>Share</button>
                    </div>
                </div>

                <div style={centerCardStyle}>
                    <div style={{ color: "#9fb8d6" }}>Loading document…</div>
                </div>
            </div>
        )
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
        <div style={outerContainerStyle}>
            <div style={headerStyle}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={logoStyle}>CL</div>
                    <div>
                        <div style={{ color: "#61dafb", fontSize: 20, fontWeight: 700 }}>{title ?? "Untitled"}</div>
                    </div>
                </div>

                {/* right side: connection status + sleek share button */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ color: connected ? "#9fe0a6" : "#f6c85f", fontSize: 13 }}>
                        {connected ? "connected" : "connecting..."}
                    </div>
                    <button onClick={handleShare} style={createLikeButtonStyle}>Share</button>
                </div>
            </div>

            {/* Editor area: position:relative so the language badge can sit top-right */}
            <div style={{ ...editorContainerStyle, position: "relative" }}>
                {/* language badge top-right inside editor */}
                <textarea
                    value={content}
                    onChange={e => handleChange(e.target.value)}
                    spellCheck={false}
                    style={textareaStyle}
                />

                {language && (
                    <select
                        value={language}
                        onChange={(e) => changeLanguage(e.target.value)}
                        style={languageDropdownStyle}
                    >
                        {LANGUAGES.map(lang => (
                            <option key={lang.id} value={lang.id}>
                                {lang.label}
                            </option>
                        ))}
                    </select>
                )}
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


const outerContainerStyle: React.CSSProperties = {
    backgroundColor: "#0f1724",
    color: "#d4d4d4",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily:
        "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace",
    boxSizing: "border-box",
}

const headerStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "12px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    background: "linear-gradient(180deg, rgba(14,30,54,0.9), rgba(20,34,60,0.9))",
    position: "sticky",
    top: 0,
    zIndex: 20,
}

const logoStyle: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 8,
    background: "linear-gradient(135deg,#0b63a6,#005a99)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
    flexShrink: 0,
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
}

/* create-like button style (matches NewDocumentView Create) */
const createLikeButtonStyle: React.CSSProperties = {
    padding: "0.55rem 0.9rem",
    fontSize: 13,
    background: "linear-gradient(180deg,#007acc,#005a99)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,90,153,0.18)",
}

/* language badge inside editor (top-right) */
const languageBadgeStyle: React.CSSProperties = {
    position: "absolute",
    right: 20,
    top: 18,
    background: "rgba(255,255,255,0.04)",
    color: "#9fb8d6",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 12,
    boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    pointerEvents: "none",
}

/* center card for loading/error states */
const centerCardStyle: React.CSSProperties = {
    margin: "48px auto",
    padding: 18,
    maxWidth: 820,
    textAlign: "center",
    color: "#9fb8d6",
}

const editorContainerStyle: React.CSSProperties = {
    flex: 1,              // grow to fill remaining space
    minHeight: 0,         // allow flexbox to calculate height correctly
    display: "flex",
    padding: 18,
    boxSizing: "border-box",
}

const textareaStyle: React.CSSProperties = {
    flex: 1,              // instead of width/height 100%
    resize: "none",
    border: "none",
    outline: "none",
    backgroundColor: "#071025",
    color: "#e6eef6",
    padding: "1rem",
    borderRadius: 8,
    fontFamily:
        "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace",
    fontSize: 14,
    lineHeight: 1.45,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
}

const shareButtonStyle: React.CSSProperties = {
    padding: "0.55rem 0.9rem",
    fontSize: 13,
    background: "linear-gradient(180deg,#007acc,#005a99)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(0,90,153,0.18)",
    transition: "transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease",
    WebkitTapHighlightColor: "transparent",
}

const languageDropdownStyle: React.CSSProperties = {
    position: "absolute",
    right: 20,
    top: 18,
    background: "rgba(255,255,255,0.04)",
    color: "#9fb8d6",
    padding: "6px 10px",
    borderRadius: 8,
    fontSize: 12,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
    appearance: "none",
    fontFamily: "'Cascadia Code', monospace",
    zIndex: 1000,
    pointerEvents: "auto"
};


