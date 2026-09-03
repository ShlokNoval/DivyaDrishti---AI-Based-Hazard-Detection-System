import { io, Socket } from 'socket.io-client';
import { AnnotatedFrameResponse, Incident } from './types';

type AlertCallback = (alert: Incident) => void;
type FrameCallback = (response: AnnotatedFrameResponse) => void;
type StatusCallback = (connected: boolean) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private statusCallbacks = new Set<StatusCallback>();

  private getConnectionConfig(): { url: string; options: Record<string, unknown> } {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

      if (isLocal) {
        const backendUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
        return {
          url: backendUrl,
          options: { transports: ['websocket', 'polling'] },
        };
      } else {
        // Through ngrok/proxy (phone): MUST force polling-only.
        // Next.js dev server accepts WebSocket upgrades for its own HMR — if we
        // let Socket.io try WebSocket first, it "connects" to Next.js (not the
        // backend) and raw_frame events go nowhere.
        // HTTP polling requests ARE correctly proxied by the /socket.io rewrite → port 8000.
        return {
          url: window.location.origin,
          options: { transports: ['polling'] },
        };
      }
    }
    return { url: 'http://localhost:8000', options: { transports: ['websocket', 'polling'] } };
  }

  /** Subscribe to real-time WebSocket connection status updates */
  onStatusChange(cb: StatusCallback): () => void {
    this.statusCallbacks.add(cb);
    return () => { this.statusCallbacks.delete(cb); };
  }

  private notifyStatus(connected: boolean) {
    this.statusCallbacks.forEach((cb) => cb(connected));
  }

  connect() {
    if (typeof window === 'undefined') return;
    if (this.socket?.connected) return;

    // Clean up any stale socket
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const config = this.getConnectionConfig();
    console.log(`[WS] Connecting to "${config.url || 'current origin'}"...`);

    this.socket = io(config.url || undefined, {
      path: '/socket.io',
      autoConnect: true,
      transports: config.options.transports as ('websocket' | 'polling')[],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 10000,
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected. SID:', this.socket?.id);
      this.notifyStatus(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WS] Disconnected:', reason);
      this.notifyStatus(false);
    });

    this.socket.on('connect_error', (err) => {
      if (err.message !== 'xhr poll error') {
        console.error('[WS] Connection error:', err.message);
      }
      this.notifyStatus(false);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.notifyStatus(false);
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ─── Frame Streaming ──────────────────────────────────────────────────────

  subscribeToFrames(onFrame: FrameCallback) {
    if (!this.socket) this.connect();
    this.socket?.on('frame_stream', (data: AnnotatedFrameResponse) => {
      onFrame(data);
    });
  }

  unsubscribeFromFrames(onFrame?: FrameCallback) {
    if (onFrame) {
      this.socket?.off('frame_stream', onFrame);
    } else {
      this.socket?.off('frame_stream');
    }
  }

  private isSendingFrame = false;

  async sendFrame(base64Frame: string, timestamp: number, location?: { lat: number; lng: number }, source: 'live' | 'upload' = 'live') {
    if (this.isSendingFrame) return;

    this.isSendingFrame = true;
    try {
      if (typeof window !== 'undefined') {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Mobile fallback via HTTP POST for absolute stability through ngrok proxy
        if (!isLocal) {
          await fetch('/api/frame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frame: base64Frame, timestamp, location, source })
          }).catch(() => {});
          return;
        }
      }

      if (!this.socket?.connected) {
        this.connect();
        await new Promise((r) => setTimeout(r, 500));
      }
      if (this.socket?.connected) {
        this.socket.emit('raw_frame', { frame: base64Frame, timestamp, location, source });
      }
    } catch (e) {
      console.error('[WS] sendFrame error:', e);
    } finally {
      this.isSendingFrame = false;
    }
  }

  // ─── Alert Subscription ───────────────────────────────────────────────────

  private processedAlertIds = new Set<string>();

  subscribeToAlerts(onAlert: AlertCallback) {
    if (!this.socket) this.connect();
    this.socket?.on('new_alert', (alert: Incident) => {
      if (!this.processedAlertIds.has(alert.id)) {
        this.processedAlertIds.add(alert.id);
        onAlert(alert);
      }
      // Keep set from growing infinitely
      if (this.processedAlertIds.size > 200) {
        const iterator = this.processedAlertIds.values();
        for (let i = 0; i < 50; i++) this.processedAlertIds.delete(iterator.next().value!);
      }
    });
  }

  unsubscribeFromAlerts() {
    this.socket?.off('new_alert');
  }
}

// Singleton export
export const wsService = new WebSocketService();
