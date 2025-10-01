import React, { useState } from "react"
import { createDocument } from "../services/api"

export function NewDocumentView({ onCreated }: { onCreated: (doc: any) => void }) {
    const [title, setTitle] = useState("")
    const [language, setLanguage] = useState("javascript")
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const doc = await createDocument({ title, language, content: "" })
            // update URL so link is shareable
            const url = new URL(window.location.href)
            url.searchParams.set("id", doc.id)
            window.history.replaceState(null, "", url.toString())

            onCreated(doc) // let parent (App.tsx) know about the new doc
        } catch (err) {
            console.error("Failed to create document", err)
            setError("Failed to create doc")
        }
    }

    return (
        <div style={{ padding: "2rem" }}>
            <h1>Create new document</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>
                        Title:
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            required
                        />
                    </label>
                </div>
                <div>
                    <label>
                        Language:
                        <select
                            value={language}
                            onChange={e => setLanguage(e.target.value)}
                        >
                            <option value="javascript">JavaScript</option>
                            <option value="typescript">TypeScript</option>
                            <option value="python">Python</option>
                        </select>
                    </label>
                </div>
                <button type="submit">Create</button>
            </form>
            {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
    )
}
