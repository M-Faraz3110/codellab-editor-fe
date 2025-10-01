import React, { useState } from "react"
import { createDocument } from "../services/api"

export function NewDocumentView({ onCreated }: { onCreated: (doc: any) => void }) {
    const [title, setTitle] = useState("")
    const [language, setLanguage] = useState("javascript")
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        try {
            const doc = await createDocument({ title, language, content: "" })
            const url = new URL(window.location.href)
            url.searchParams.set("id", doc.id)
            window.history.replaceState(null, "", url.toString())
            onCreated(doc)
        } catch (err) {
            console.error(err)
            setError("Failed to create document")
        } finally {
            setCreating(false)
        }
    }

    return (
        <div
            style={{
                backgroundColor: "#1e1e2f",
                color: "#d4d4d4",
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",   // center vertically and horizontally
                alignItems: "center",       // center vertically and horizontally
                fontFamily:
                    "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace",
                padding: "1rem",
                boxSizing: "border-box",
            }}
        >
            {/* Centered inner column */}
            <div
                style={{
                    width: "100%",
                    maxWidth: 720,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1.25rem",
                    boxSizing: "border-box",
                    padding: "1rem",
                }}
            >
                {/* Header (logo + subheading) - centered and OUTSIDE the form */}
                <header
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        width: "100%",
                        boxSizing: "border-box",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>


                        <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                            <h1 style={{ margin: 0, color: "#61dafb", fontSize: 28, lineHeight: 1 }}>
                                [PLACEHOLDER]
                            </h1>
                            <div style={{ color: "#9cdcfe", fontSize: 13, marginTop: 4 }}>
                                Google docs + pastebin?
                            </div>
                        </div>
                    </div>
                </header>

                {/* Card/form */}
                <form
                    onSubmit={handleSubmit}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "1rem",
                        backgroundColor: "#252540",
                        padding: "1.75rem",
                        borderRadius: 10,
                        boxShadow: "0 8px 30px rgba(0,0,0,0.45)",
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                    }}
                >
                    <div style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
                        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 13, color: "#9fb8d6" }}>Title</span>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                                placeholder="Untitled"
                                style={{
                                    padding: "0.6rem 0.75rem",
                                    fontSize: "0.98rem",
                                    borderRadius: 6,
                                    border: "1px solid #3c3c5c",
                                    backgroundColor: "#1e1e2f",
                                    color: "#d4d4d4",
                                    outline: "none",
                                }}
                            />
                        </label>

                        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <span style={{ fontSize: 13, color: "#9fb8d6" }}>Language</span>
                            <div style={{ position: "relative" }}>
                                <select
                                    value={language}
                                    onChange={e => setLanguage(e.target.value)}
                                    style={{
                                        appearance: "none",
                                        WebkitAppearance: "none",
                                        MozAppearance: "none",
                                        padding: "0.6rem 2.5rem 0.6rem 0.75rem",
                                        fontSize: "0.98rem",
                                        borderRadius: 6,
                                        border: "1px solid #3c3c5c",
                                        backgroundColor: "#1e1e2f",
                                        color: "#d4d4d4",
                                        width: "100%",
                                        boxSizing: "border-box",
                                    }}
                                >
                                    <option value="javascript">JavaScript</option>
                                    <option value="typescript">TypeScript</option>
                                    <option value="python">Python</option>
                                    <option value="json">JSON</option>
                                </select>

                                <div
                                    style={{
                                        position: "absolute",
                                        right: 10,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        pointerEvents: "none",
                                        color: "#9fb8d6",
                                        fontSize: 12,
                                    }}
                                >
                                    ▾
                                </div>
                            </div>
                        </label>
                    </div>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                        <button
                            type="submit"
                            disabled={creating}
                            style={{
                                padding: "0.65rem 1rem",
                                fontSize: "0.98rem",
                                background: "linear-gradient(180deg,#007acc,#005a99)",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                cursor: creating ? "not-allowed" : "pointer",
                                boxShadow: "0 6px 18px rgba(0,90,153,0.18)",
                                transition: "transform 0.12s ease, box-shadow 0.12s ease",
                            }}
                            onMouseDown={e => (e.currentTarget.style.transform = "translateY(1px)")}
                            onMouseUp={e => (e.currentTarget.style.transform = "translateY(0)")}
                            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                        >
                            {creating ? "Creating..." : "Create"}
                        </button>
                    </div>

                    {error && <p style={{ color: "#f87171", margin: 0 }}>{error}</p>}
                </form>
            </div>
        </div>
    )
}
