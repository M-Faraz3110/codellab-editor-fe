import { WSMessage, Operation } from '../types'

class WSClient {
  ws: WebSocket | null = null
  url: string
  onMessage: (msg: WSMessage)=>void = ()=>{}
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;

  constructor(url: string){
    this.url = url
  }

  connect(): void{
    console.log("WSClient.connect called", this.ws?.readyState)
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log("WebSocket already connecting/open")
      return
    }
      
    this.ws = new WebSocket(this.url)
    this.ws.onmessage = (ev: MessageEvent) =>{
      try{
        const msg = JSON.parse(ev.data) as WSMessage
        this.onMessage(msg)
      }catch(e){
        console.warn('ws parse', e)
      }
    }
    this.ws.onopen = ()=>console.log('ws open')
    this.ws.onclose = () => console.log('ws close')
    this.ws.onerror = (ev) => console.log("ws error", ev)
    this.ws.onclose = (ev) => console.log("ws close", ev.code, ev.reason)  
  }

  send(msg: WSMessage): void{
    console.log(msg)
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log("THIS SHOULD SEND")
        this.ws.send(JSON.stringify(msg))  
      }
        
  }

  sendOperation(id: string, op: Operation): void{
    console.log("SENDING")
    this.send({ type: 'operation', id, operation: op })
  }

  sendDocumentUpdate(id: string, update: { title?: string | null; language?: string | null }): void {
    this.send({ type: 'document_update', id, document_update: update })
  }

  sendSnapshotUpdate(id: string, update: {content?: string | null }): void {
    this.send({ type: 'snapshot', id, snapshot: update })
  }

  sendReady(payload: any) {
    this.send(payload);
  }
    
  disconnect(): void{
    console.log("WSClient.disconnect called", this.ws?.readyState)
    if (!this.ws) return
    if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
    }
    this.ws = null
  }
}

// Singleton wrapper that survives HMR
const getGlobalWS = (url: string) => {
  const key = "__CODELAB_WS_CLIENT__";
  // @ts-ignore
  if (!window[key]) {
    // @ts-ignore
    window[key] = new WSClient(url);
  }
  // @ts-ignore
  return window[key] as WSClient;
};
export default getGlobalWS;
