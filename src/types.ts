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

// WebSocket envelope we send/receive
export type WSMessage =
  | { type: 'operation'; id: string; operation: Operation }
  | { type: 'document_update'; id: string; update: DocumentUpdate }
  | { type: string; [key: string]: unknown }

export type DocumentUpdate = {
  title?: string | null
  content?: string | null
  language?: string | null
}
