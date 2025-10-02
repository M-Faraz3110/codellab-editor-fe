import axios from 'axios'
import { Document } from '../types'

// Use explicit /api prefix so the Vite dev proxy can forward requests in development.
// If VITE_BACKEND_HTTP is provided, use it as the origin and append /api.
const envBase = import.meta.env.VITE_BACKEND_HTTP
const API_BASE = envBase ? `${String(envBase).replace(/\/$/, '')}/api` : '/api'

export async function listDocuments() {
  const res = await axios.get(`${API_BASE}/documents`)
  return res.data
}

export async function createDocument(body: { title: string; content?: string; language?: string }) : Promise<Document> {
  const res = await axios.post<Document>(`${API_BASE}/documents`, body)
  console.log("response: " + JSON.stringify(res.data))
  return res.data
}

export async function deleteDocument(id: string) {
  const res = await axios.delete(`${API_BASE}/documents/${id}`)
  return res.data
}

export async function getDocument(id: string) {
  const res = await axios.get(`${API_BASE}/documents/${id}`)
  return res.data
}
