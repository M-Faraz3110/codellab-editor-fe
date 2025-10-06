import React, { useState } from "react"
import { createDocument } from "../services/api"
import { Document } from "../types"
import { TextType } from "./ui/TextType"
import FaultyTerminal from "./ui/FaultyTerminal"
import { Input, InputGroup, InputLeftElement, InputRightElement } from "@chakra-ui/react"
import { ChevronDownIcon } from "@chakra-ui/icons"
import Dither from "./ui/Dither"
import { Button } from "./ui/button"
import ShinyText from "./ui/ShinyText"

const glowStyles = `
  @keyframes glow {
    0% {
      box-shadow: 0 0 5px rgba(255, 255, 255, 0.3),
                 0 0 10px rgba(255, 255, 255, 0.2),
                 0 0 15px rgba(255, 255, 255, 0.1);
    }
    100% {
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.4),
                 0 0 20px rgba(255, 255, 255, 0.3),
                 0 0 30px rgba(255, 255, 255, 0.2);
    }
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
    }
    100% {
      transform: scale(1);
      box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
    }
  }

  .button-pulse {
    animation: pulse 2s infinite ease-in-out;
  }

  .button-pulse:hover {
    animation: none;
  }
`;


export function NewDocumentView({ onCreated }: { onCreated: (doc: Document) => void }) {
    const [title, setTitle] = useState("")
    const [language, setLanguage] = useState(".js")
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    //const [selectedExt, setSelectedExt] = useState('.js')

    const handleSubmit = async (e: React.FormEvent) => {
        console.log("submitting")
        e.preventDefault()
        setCreating(true)
        try {
            console.log("language " + language)
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
        <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
            <style dangerouslySetInnerHTML={{ __html: glowStyles }} />

            {/* GitHub Link */}
            <a
                href="https://github.com/M-Faraz3110/codellab-editor-fe"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1rem",
                    zIndex: 10,
                    opacity: 0.7,
                    transition: "opacity 0.2s",
                    cursor: "pointer",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "0.7"}
            >
                <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="white"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
            </a>

            {/* Background Terminal */}
            <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2
            }}>
                <Dither
                    waveColor={[0.76, 0.76, 0.76]}
                    disableAnimation={false}
                    enableMouseInteraction={true}
                    mouseRadius={0.7}
                    colorNum={4}
                    waveAmplitude={0.05}
                    waveFrequency={4}
                    waveSpeed={0.05}
                    pixelSize={3}
                />
                {/* <FaultyTerminal tint="#39ff14" brightness={1.5} glitchAmount={0.3} /> */}
            </div>

            {/* Main Content */}
            <div
                style={{
                    position: "relative",
                    color: "#d4d4d4",
                    minHeight: "100vh",
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontFamily: "Helvetica, Arial, sans-serif",
                    padding: "1rem",
                    boxSizing: "border-box",
                    background: "rgba(30, 30, 47, 0.6)",
                }}>

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


                            <div style={{ display: "flex", flexDirection: "column", textAlign: "center" }}>
                                <h1 style={{
                                    margin: 0,
                                    color: "#ffffff",
                                    fontSize: 64,
                                    lineHeight: 1.2,
                                    fontWeight: 800,
                                    textShadow: "0 0 20px rgba(255,255,255,0.2)",
                                    letterSpacing: "-0.02em",
                                    zIndex: 3,
                                    fontFamily: "Helvetica, Arial, sans-serif"
                                }}>
                                    [PLACEHOLDER]
                                </h1>
                                <div style={{
                                    color: "#9cdcfe",
                                    fontSize: 13,
                                    marginTop: 4,
                                    minHeight: "1.5em",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "100%",
                                    zIndex: 3,
                                    fontFamily: "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace"
                                }}>
                                    <TextType
                                        text={[
                                            "Real-time collaborative code editor",
                                            "Google docs for code?",
                                            "Does this even have a real life use case...?"
                                        ]}
                                        typingSpeed={50}
                                        initialDelay={1000}
                                        pauseDuration={2000}
                                        deletingSpeed={30}
                                        loop={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </header>

                    <div style={{ position: 'relative', zIndex: 100 }}>
                        <InputGroup>
                            <InputLeftElement
                                pointerEvents="none"
                                color="gray.500"
                                width="auto"
                                pl={4}
                                children="$ touch"
                                style={{ fontFamily: "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace" }}
                            />
                            <Input
                                pl="6.0rem"
                                pr="4.0rem"
                                placeholder="your_file"
                                bgColor="#1e1e1e"
                                borderColor="whiteAlpha.200"
                                color="whiteAlpha.900"
                                _placeholder={{ color: "gray.500", textAlign: "center", fontFamily: "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace" }}
                                borderRadius="full"
                                textAlign="center"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                style={{ fontFamily: "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace" }}
                            />
                            <InputRightElement width="5.5rem">
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    paddingRight: '0.2rem',
                                    fontFamily: "'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', monospace"
                                }}>
                                    <span style={{ color: 'gray.500' }}>{language}</span>
                                    <ChevronDownIcon
                                        color="gray.500"
                                        cursor="pointer"
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    />
                                </div>
                            </InputRightElement>
                        </InputGroup>
                        {isDropdownOpen && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: '1rem',
                                    width: '4rem',
                                    backgroundColor: '#1e1e2f',
                                    borderRadius: '6px',
                                    border: '1px solid #3c3c5c',
                                    zIndex: 10,
                                    marginTop: '0.25rem',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                    overflow: 'hidden'
                                }}
                            >
                                {['.js', '.ts', '.py', '.json'].map((ext) => (
                                    <div
                                        key={ext}
                                        onClick={() => {
                                            setLanguage(ext);
                                            setIsDropdownOpen(false);
                                        }}
                                        style={{
                                            padding: '0.4rem',
                                            fontSize: '0.9rem',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            color: '#d4d4d4',
                                            backgroundColor: ext === language ? '#2a2a3f' : 'transparent',
                                            transition: 'background-color 0.2s'
                                        }}
                                        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                                            e.currentTarget.style.backgroundColor = '#2a2a3f';
                                        }}
                                        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                                            e.currentTarget.style.backgroundColor = ext === language ? '#2a2a3f' : 'transparent';
                                        }}
                                    >
                                        {ext}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>



                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', margin: '2rem auto', zIndex: 10 }}>
                        <Button
                            onClick={handleSubmit}
                            className="button-pulse min-w-[300px] p-4 rounded-full bg-black/80 backdrop-blur 
                            border-2 border-white/20 
                            flex items-center justify-center relative overflow-hidden z-10
                            shadow-[0_0_15px_rgba(255,255,255,0.1)] 
                            transition-all duration-300 ease-in-out
                            hover:scale-105 hover:border-white/40 
                            hover:shadow-[0_0_30px_rgba(255,255,255,0.2),inset_0_0_20px_rgba(255,255,255,0.2)] 
                            hover:bg-white/10
                            active:scale-95 active:shadow-[0_0_10px_rgba(255,255,255,0.1)]
                            before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent 
                            before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-1000
                            hover:brightness-125"
                            style={{
                                background: 'rgba(0, 0, 0, 0.65)',
                                backdropFilter: 'blur(10px)',
                                padding: '1rem 1rem',
                                borderRadius: '9999px',
                                transition: 'all 0.3s ease',
                                minWidth: '300px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 0 15px rgba(255, 255, 255, 0.1), inset 0 0 15px rgba(255, 255, 255, 0.1)',
                                animation: 'borderGlow 2s ease-in-out infinite alternate',
                                border: '2px solid rgba(255, 255, 255, 0.2)',
                                zIndex: 10,
                                fontSize: "21px",
                                fontWeight: "500",
                            }}
                        >
                            <ShinyText text="CREATE FILE" speed={3} className="bright-text" />
                        </Button>
                    </div>                    {/* Card/form
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
                    </form> */}
                </div>

                {/* Footnote */}
                <div style={{
                    position: "absolute",
                    bottom: "1rem",
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontSize: "0.8rem",
                    color: "rgba(255, 255, 255, 0.7)",
                    pointerEvents: "auto",
                    zIndex: 3,
                    fontFamily: "Helvetica, Arial, sans-serif"
                }}>
                    *If the button doesn't work, it's just Render booting up the backend. Just wait a bit
                </div>
            </div>
        </div>
    )
}
