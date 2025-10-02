// Shared types for the frontend

export type OperationType = 'insert' | 'delete' | 'retain'

export type Operation = {
  type: OperationType
  position: number
  content?: string
  length?: number
  client_id: string
  timestamp: number
}

export type Document = {
  id: string
  title: string
  content: string
  language: string
  created_at: Date
  updated_at: Date
  version: number
}

// WebSocket envelope we send/receive
export type WSMessage =
  | { type: 'operation'; id: string; operation: Operation }
  | { type: 'document_update'; id: string; title: string | null, language: string | null }
  | { type: 'snapshot'; id: string; content: string; title?: string; language?: string}

export type DocumentUpdate = {
  title?: string | null
  content?: string | null
  language?: string | null
}
