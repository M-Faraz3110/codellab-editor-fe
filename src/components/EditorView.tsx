import React, { useEffect, useRef, useState, useCallback } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import type * as MonacoEditor from 'monaco-editor'
import type * as monaco from "monaco-editor"
import { getDocument } from '../services/api'
import type { Operation, PresenceUser, WSMessage } from '../types'
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
    const [lastSyncTime, setLastSyncTime] = useState<number | null>(null)
    const [isContentSynced, setIsContentSynced] = useState<boolean>(true)

    const [username, setUsername] = useState("");
    const [modalOpen, setModalOpen] = useState(true);
    const [showCopySuccess, setShowCopySuccess] = useState(false);
    const [users, setUsers] = useState<PresenceUser[]>([]);
    const [meId, setMeId] = useState<string>('');
    const decorationsRef = useRef<Record<string, string[]>>({});
    // new ref for disposing cursor listener
    const cursorListenerRef = useRef<{ dispose: () => void } | null>(null);


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

    // Set up interval for sending snapshots every 5 seconds
    useEffect(() => {
        // Don't start interval until we're connected and have a username
        if (!connected || !username) return;

        console.log('Setting up snapshot interval');
        let snapshotCount = 0;

        const intervalId = setInterval(() => {
            snapshotCount++;
            const formattedUsers = users.map(user => ({
                id: user.id,
                username: user.username
            }));
            console.log(`Sending snapshot #${snapshotCount} with content length:`, contentRef.current.length);
            console.log('Current users:', formattedUsers);
            wsRef.current?.sendSnapshotUpdate(id, {
                content: contentRef.current,
                users: formattedUsers
            });
            setLastSyncTime(Date.now());
            setIsContentSynced(true);
        }, 5000);

        // Clean up interval on unmount or when connection/username changes
        return () => {
            console.log('Cleaning up snapshot interval');
            clearInterval(intervalId);
        };
    }, [connected, username, id, users]); // Recreate interval if these change

    // Debug users state changes
    useEffect(() => {
        console.log("Users state updated:", users);
    }, [users]);

    // Ensure we have a persistent client id stored in local state when component mounts
    useEffect(() => {
        const id = getClientId();
        setMeId(id);
    }, []);

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
        // Don't connect until username is set and modal is closed
        if (modalOpen || !username.trim()) {
            setLoading(false) // Don't show loading when waiting for username
            return;
        }

        setLoading(true)
        let mounted = true;

        // Get the singleton WS client with connection params
        const ws = getGlobalWS(WS_URL, {
            id: meId,
            username: username
        });
        wsRef.current = ws;

        // Attach message handler
        ws.onMessage = (msg: WSMessage) => {
            if (!msg || !mounted) return;
            switch (msg.type) {
                //add presence message
                case "presence_user": {
                    console.log("received presence")
                    if (typeof msg.username === "string" && msg.id) {
                        const incoming: PresenceUser = {
                            id: msg.id,
                            username: msg.username,
                            color: typeof msg.color === 'string' ? msg.color : colorFromString(msg.id),
                            cursor: (typeof msg.lineNumber === 'number' && typeof msg.column === 'number') ? { lineNumber: msg.lineNumber, column: msg.column } : null,
                        }

                        setUsers(prev => {
                            const idx = prev.findIndex(u => u.id === incoming.id)
                            if (idx === -1) return [...prev, incoming]
                            const next = [...prev]
                            next[idx] = { ...next[idx], ...incoming }
                            return next
                        })
                    }
                    break;
                }
                case "init_ok": {
                    console.log("recieved ok", msg.id, msg.username)
                    if (msg.id.length != 0 && msg.username) {
                        setUsers(prev => {
                            // Add or update the user
                            const incoming = {
                                id: msg.id,
                                username: msg.username,
                                color: colorFromString(msg.id),
                                cursor: null
                            };
                            const idx = prev.findIndex(u => u.id === msg.id);
                            if (idx === -1) return [...prev, incoming];
                            const next = [...prev];
                            next[idx] = { ...next[idx], ...incoming };
                            return next;
                        });
                    }
                    break;
                }
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
                    if (msg.users && Array.isArray(msg.users)) {
                        console.log("received users")
                        setUsers(prev => {
                            // Filter and transform users, ensuring we only include valid entries
                            return msg.users
                                .filter(newUser => newUser.id && newUser.id.length > 0 && newUser.username && newUser.username.length > 0)
                                .map(newUser => {
                                    // Find if we have existing data for this user
                                    const existingUser = prev.find(u => u.id === newUser.id);
                                    if (existingUser) {
                                        // Keep existing data (color, cursor) but update username if changed
                                        return {
                                            ...existingUser,
                                            username: newUser.username
                                        };
                                    }
                                    // For new users, create a fresh entry with a generated color
                                    return {
                                        id: newUser.id,
                                        username: newUser.username,
                                        color: colorFromString(newUser.id),
                                        cursor: null
                                    };
                                });
                        });
                        console.log(users)
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

                case "user_left": {
                    if (typeof msg.id === "string" && msg.id.length > 0) {
                        console.log("User left message received for:", msg.id);
                        setUsers(prev => {
                            console.log("Current users before removal:", prev);
                            const leavingUser = prev.find(u => u.id === msg.id);
                            if (leavingUser) {
                                console.log(`Removing user ${leavingUser.username} (${msg.id}) from session`);
                                // Simply filter out the user - cursor cleanup happens in users effect
                                return prev.filter(user => user.id !== msg.id);
                            }
                            console.log("User not found in current users list");
                            return prev;
                        });
                    }
                    break;
                }
            }
        };

        // Attach onClose/error handlers for debugging
        ws.onClose = (ev: CloseEvent) => console.log("WS closed", ev.code, ev.reason);
        ws.onError = (ev: Event) => console.log("WS error", ev);

        // Connect (or reuse singleton)
        ws.connect();

        return () => {
            mounted = false;

            if (ws) {
                // Clear handlers before disconnecting
                ws.onMessage = () => { };
                ws.onOpen = () => { };
                ws.onClose = () => { };
                ws.onError = () => { };

                // Disconnect and clear ref
                ws.disconnect();
                wsRef.current = null;
            }
        };
    }, [id, username, modalOpen]);


    useEffect(() => {
        console.log("Setting up cursor position handler", {
            hasEditor: !!editorRef.current,
            hasWS: !!wsRef.current,
            modalOpen,
            hasUsername: !!username
        });

        const editor = editorRef.current;
        const ws = wsRef.current;
        if (!editor || !ws) {
            console.log("Missing required refs:", { editor: !!editor, ws: !!ws });
            return;
        }

        // dispose previous if any
        if (cursorListenerRef.current) {
            console.log("Disposing previous cursor listener");
            cursorListenerRef.current.dispose();
        }

        // register cursor move handler
        const disposable = editor.onDidChangeCursorPosition((e: monaco.editor.ICursorPositionChangedEvent) => {
            const pos = e.position;
            const currentWS = wsRef.current;  // Get fresh ref value
            // only send if socket exists and username/modal is set
            if (currentWS && !modalOpen && username) {
                console.log("sending presence update", {
                    position: pos,
                    username,
                    userId: meId
                });
                currentWS.sendPresenceUpdate(id, {
                    username: username,
                    color: users.find(u => u.id == meId)?.color ?? colorFromString(meId),
                    column: pos.column,
                    lineNumber: pos.lineNumber,
                });
            } else {
                console.log("Skipping presence update:", {
                    hasWS: !!currentWS,
                    modalOpen,
                    hasUsername: !!username
                });
            }
        });

        // store disposable for cleanup
        cursorListenerRef.current = disposable;

        return () => {
            console.log("Cleaning up cursor position handler");
            if (cursorListenerRef.current) {
                cursorListenerRef.current.dispose();
                cursorListenerRef.current = null;
            }
        };
        // Note: Don't put ref.current values in dependencies
        // Instead, respond to the values that might cause refs to change
    }, [modalOpen, username, meId, id, users]);

    // add this useEffect (runs when 'users' changes)
    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;

        const newDecorationMap: Record<string, string[]> = {};

        users.forEach((u) => {
            if (!u.cursor) {
                if (decorationsRef.current[u.id]) {
                    try { editor.deltaDecorations(decorationsRef.current[u.id], []); } catch { }
                    delete decorationsRef.current[u.id];
                }
                return;
            }

            if (u.id === meId) return; // skip rendering our own remote cursor

            ensureCursorStyleForUser(u.id, u.color || colorFromString(u.id));

            const range = new monaco.Range(u.cursor.lineNumber, u.cursor.column, u.cursor.lineNumber, u.cursor.column);
            const opts = {
                range,
                options: {
                    className: `remote-cursor-${u.id}`,
                    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                },
            } as any;

            try {
                const previous = decorationsRef.current[u.id] || [];
                const next = editor.deltaDecorations(previous, [opts]);
                newDecorationMap[u.id] = next;
            } catch (err) {
                // ignore potential invalid-range errors during rapid updates
            }
        });

        // cleanup decorations for users that disappeared
        Object.keys(decorationsRef.current).forEach((uid) => {
            if (!newDecorationMap[uid]) {
                try { editor.deltaDecorations(decorationsRef.current[uid], []); } catch { }
                delete decorationsRef.current[uid];
            }
        });

        decorationsRef.current = { ...decorationsRef.current, ...newDecorationMap };
    }, [users, meId]);


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

    // add deterministic small id
    function genShortId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    // Generate a highly unique color from string
    function colorFromString(s: string) {
        // Use different parts of string for different components
        let h1 = 0, h2 = 0;
        for (let i = 0; i < s.length; i++) {
            const char = s.charCodeAt(i);
            h1 = (h1 * 37 + char) | 0;  // Use 37 for hue
            h2 = (h2 * 23 + char) | 0;  // Use 23 for saturation/lightness
        }

        // Generate color components with good range and variation
        const hue = Math.abs(h1) % 360;  // Full hue range
        const sat = 65 + (Math.abs(h2) % 20);  // Saturation between 65-85%
        const light = 45 + (Math.abs(h1 + h2) % 20);  // Lightness between 45-65%

        return `hsl(${hue} ${sat}% ${light}%)`;
    }

    function ensureCursorStyleForUser(userId: string, color: string) {
        const styleId = `remote-cursor-style-${userId}`;
        if (document.getElementById(styleId)) return;
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
            .remote-cursor-${userId} {
            border-left: 2px solid ${color};
            margin-left: -1px;
            box-sizing: border-box;
            height: 1em;
            display: inline-block;
            }
        `;
        document.head.appendChild(style);
    }

    function handleChange(value?: string) {
        console.log("HANDLING CHANGE")
        console.log("Current users state in handleChange:", users)
        const newContent = value || ''
        const oldContent = content
        setContent(newContent)
        setIsContentSynced(false)
        console.log(content)

        // compute diffs using local simpleDiff and emit Operation messages
        const diffs = simpleDiff(oldContent, newContent)
        let cursor = 0
        const clientId = meId
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
        // Format if needed
        debouncedFormat()
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
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000); // Reset after 2 seconds
        try {
            await navigator.clipboard.writeText(href)
            // small visual feedback
            // you may replace alert with your toast if you have one
        } catch (err) {
            // fallback: show URL in prompt for manual copy
            // eslint-disable-next-line no-alert
            window.prompt("Copy link to share:", href)
        }
    }

    // Show username modal regardless of loading state
    if (modalOpen) {
        return (
            <div style={outerContainerStyle}>
                {/* username modal */}
                <div style={modalOverlayStyle}>
                    <form
                        onSubmit={onSubmitUsername}
                        style={modalFormStyle}
                        role="dialog"
                        aria-modal="true"
                    >
                        <h2 style={{ color: '#61dafb', fontSize: '20px', marginTop: 0, marginBottom: '8px' }}>
                            Enter a username
                        </h2>
                        <p style={{ color: '#9fb8d6', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
                            Choose a name other people will see in the collaboration session
                        </p>
                        <label style={{ display: 'block' }}>
                            <input
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={modalInputStyle}
                                placeholder="Your display name"
                            />
                        </label>

                        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                style={modalCancelButtonStyle}
                                onClick={() => {
                                    window.location.href = '/';
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!username.trim()}
                                style={{
                                    ...modalJoinButtonStyle,
                                    opacity: username.trim() ? 1 : 0.5,
                                    cursor: username.trim() ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Join Session
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // Show loading state only after username is set
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



    function onSubmitUsername(e?: React.FormEvent) {
        if (e) e.preventDefault();
        const trimmed = username.trim();
        if (!trimmed) return;
        console.log("Submitting username. Current users:", users);

        setUsers(prev => {
            if (prev.find(u => u.id === meId)) return prev;
            return [
                ...prev,
                {
                    id: meId,
                    username,
                    color: colorFromString(meId), // fallback until server returns authoritative color
                    cursor: null,
                },
            ];
        });

        setUsername(trimmed);
        setModalOpen(false);
    }

    return (
        <div style={outerContainerStyle}>
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={headerStyle}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <div style={logoStyle}>CL</div>
                            <div>
                                <div style={{ color: "#61dafb", fontSize: 20, fontWeight: 700 }}>{title ?? "Untitled"}</div>
                            </div>
                        </div>

                        {/* right side: connection status + sleek share button */}
                        <div style={{ marginLeft: "auto", display: "flex", gap: 32, alignItems: "center" }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                                <div style={{ color: connected ? "#9fe0a6" : "#f6c85f", fontSize: 13 }}>
                                    {connected ? "connected" : "connecting..."}
                                </div>
                                {connected && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 13 }}>
                                        {isContentSynced ? (
                                            <>
                                                <span style={{ color: '#9fe0a6' }}>✓ synced</span>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ color: '#f6c85f', display: 'inline-flex', animation: 'spin 1s linear infinite' }}>↻</span>
                                                <style>{`
                                                    @keyframes spin {
                                                        from { transform: rotate(0deg); }
                                                        to { transform: rotate(360deg); }
                                                    }
                                                `}</style>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleShare}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '4px',
                                    color: '#cccccc',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    color: showCopySuccess ? '#73c991' : '#cccccc',
                                    transition: 'color 0.2s'
                                }}>
                                    {showCopySuccess ? (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M13.3333 4L6 11.3333L2.66667 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M3.33333 8V12.6667C3.33333 13.403 3.93 14 4.66667 14H11.3333C12.07 14 12.6667 13.403 12.6667 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                            <path d="M8 2V10M8 2L5.33333 4.66667M8 2L10.6667 4.66667" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Editor area: position:relative so the language badge can sit top-right */}
                    <div style={{ ...editorContainerStyle, position: "relative" }}>
                        <Editor
                            height="100%"
                            theme="vs-dark"
                            language={language}
                            value={content}
                            onChange={handleChange}
                            onMount={(editor, monaco) => {
                                console.log("editor mount");
                                editorRef.current = editor;
                                monacoRef.current = monaco;
                                const model = editor.getModel();
                                if (model) monaco.editor.setModelLanguage(model, language);
                            }}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                roundedSelection: false,
                                scrollBeyondLastLine: false,
                                readOnly: false,
                                theme: 'vs-dark'
                            }}
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
                <div style={sidebarStyle}>
                    <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: 0, color: '#61dafb', fontSize: '14px' }}>Active Users</h3>
                    </div>
                    <div style={{ padding: '12px' }}>
                        {users.map(user => (
                            <div key={user.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px',
                                borderRadius: '6px',
                                backgroundColor: user.id === meId ? 'rgba(97, 218, 251, 0.1)' : 'transparent'
                            }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: user.color || colorFromString(user.id)
                                }} />
                                <span style={{ color: '#d4d4d4', fontSize: '13px' }}>{user.username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

function getClientId(): string {
    // simple client id stored in localStorage
    const id = cryptoRandomId()
    // const key = 'collab_client_id'
    // let id = localStorage.getItem(key)
    // if (!id) {
    //     id = cryptoRandomId()
    //     localStorage.setItem(key, id)
    // }
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

const vscodeButtonStyle: React.CSSProperties = {
    background: '#2d2d2d',
    border: '1px solid #3d3d3d',
    borderRadius: '3px',
    color: '#cccccc',
    fontSize: '12px',
    padding: '4px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'background-color 0.1s'
};

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

const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
};

const modalFormStyle: React.CSSProperties = {
    backgroundColor: '#0f1724',
    borderRadius: '12px',
    padding: '24px',
    width: '400px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

const modalInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    color: '#e6eef6',
    fontSize: '14px',
    marginTop: '8px',
    outline: 'none',
    fontFamily: "'Cascadia Code', monospace",
    transition: 'border-color 0.2s, box-shadow 0.2s',
};

const modalButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    fontSize: '13px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: "'Cascadia Code', monospace",
};

const modalCancelButtonStyle: React.CSSProperties = {
    ...modalButtonStyle,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#9fb8d6',
    transition: 'background-color 0.2s ease',
};

const modalJoinButtonStyle: React.CSSProperties = {
    ...modalButtonStyle,
    background: 'linear-gradient(180deg,#007acc,#005a99)',
    color: '#ffffff',
    boxShadow: '0 4px 12px rgba(0,122,204,0.4)',
    transition: 'all 0.2s ease',
};

const sidebarStyle: React.CSSProperties = {
    width: '240px',
    backgroundColor: '#0a1019',
    borderLeft: '1px solid rgba(255,255,255,0.04)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
};

