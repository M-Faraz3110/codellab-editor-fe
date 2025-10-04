import { WSMessage, Operation } from '../types'

type ConnectionParams = {
  id: string;
  username: string;
};

class WSClient {
  ws: WebSocket | null = null;
  url: string;
  connectionParams?: ConnectionParams;
  onMessage: (msg: WSMessage) => void = () => {};
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;

  constructor(url: string, connectionParams?: ConnectionParams) {
    this.url = url;
    this.connectionParams = connectionParams;
  }

  connect(): void {
    console.log('WSClient.connect called', this.ws?.readyState);
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connecting/open');
      return;
    }
      
    this.ws = new WebSocket(this.url);

    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as WSMessage;
        this.onMessage(msg);
      } catch(e) {
        console.warn('WebSocket parse error:', e);
      }
    };

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      
      // Send init message with connection params
      if (this.connectionParams) {
        console.log('sending init')
        console.log(this.connectionParams.username)
        this.send({
          type: 'init',
          id: this.connectionParams.id,
          username: this.connectionParams.username
        });
      }
            
      this.onOpen?.();
    };

    this.ws.onclose = (ev) => {
      console.log('WebSocket closed', ev.code, ev.reason);
      this.onClose?.(ev);
    };

    this.ws.onerror = (ev) => {
      console.log('WebSocket error:', ev);
      this.onError?.(ev);
    };
  }

  send(msg: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('Sending message:', msg);
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendOperation(id: string, op: Operation): void {
    this.send({ type: 'operation', id, operation: op });
  }

  sendDocumentUpdate(id: string, update: { title?: string | null; language?: string | null }): void {
    this.send({
      type: 'document_update',
      id,
      title: update.title ?? null,
      language: update.language ?? null
    });
  }

  sendSnapshotUpdate(id: string, update: { content?: string | null, users?: Array<{ id: string; username: string }> }): void {
    console.log("sending snapshot")
    console.log(update.users)
    if (update.content && update.users) {
      this.send({ type: 'snapshot', id, content: update.content, users: update.users })
    }
  }

  sendPresenceUpdate(id: string, update: { username: string, color?: string, lineNumber?: number, column?: number }): void {
    this.send({
      type: 'presence_user',
      id,
      username: update.username,
      color: update.color,
      lineNumber: update.lineNumber,
      column: update.column
    });
  }

  sendReady(id: string, update: { username: string }) {
    console.log(update.username)
    this.send({type: "init", id: id, username: update.username});
  }
    
  disconnect(): void {
    console.log('WSClient.disconnect called', this.ws?.readyState);
    if (!this.ws) return;
    if (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
  }
}

// Singleton wrapper that survives HMR but is keyed by URL
const getGlobalWS = (url: string, connectionParams?: ConnectionParams) => {
  const key = "__CODELLAB_WS_CLIENT_MAP__";
  // @ts-ignore
  if (!window[key]) {
    // @ts-ignore
    window[key] = {} as Record<string, WSClient>;
  }
  
  // Create a unique key that includes both URL and connection params
  const paramKey = connectionParams ? new URLSearchParams(connectionParams).toString() : '';
  const mapKey = `${url}${paramKey ? '?' + paramKey : ''}`;
  
  // @ts-ignore
  if (!window[key][mapKey]) {
    // @ts-ignore
    window[key][mapKey] = new WSClient(url, connectionParams);
  }
  // @ts-ignore
  return window[key][mapKey];
};
export default getGlobalWS;