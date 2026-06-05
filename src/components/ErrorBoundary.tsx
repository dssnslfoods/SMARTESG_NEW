import { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Detects the class of error you get when the browser is holding a stale
 * index.html (from a previous deploy) and a lazily-imported route chunk whose
 * hashed filename no longer exists on the server fails to load.
 */
function isChunkLoadError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  const name = (err as { name?: string })?.name ?? '';
  return (
    name === 'ChunkLoadError' ||
    /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk \S+ failed/i.test(
      msg,
    )
  );
}

interface State {
  hasError: boolean;
  isChunk: boolean;
}

/**
 * App-wide error boundary. Without it, a thrown render error or a failed
 * dynamic import unmounts the whole React tree, leaving a blank white page.
 * On a chunk-load error (stale bundle after a deploy) it reloads once to pull
 * the new files; otherwise it shows a friendly Reload fallback.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, isChunk: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, isChunk: isChunkLoadError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App ErrorBoundary caught:', error, info);
    if (isChunkLoadError(error)) {
      // Reload once to fetch the latest index.html + chunks. The timestamp
      // guard prevents an infinite reload loop if the problem is not transient.
      const KEY = 'chunk-reload-ts';
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    sessionStorage.removeItem('chunk-reload-ts');
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f8fafc',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>{this.state.isChunk ? '🔄' : '⚠️'}</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>
            {this.state.isChunk ? 'มีเวอร์ชันใหม่ / New version available' : 'เกิดข้อผิดพลาด / Something went wrong'}
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 18px', lineHeight: 1.5 }}>
            {this.state.isChunk
              ? 'ระบบมีการอัปเดต กำลังโหลดเวอร์ชันล่าสุด — หากไม่เปลี่ยนเอง กรุณากดปุ่มด้านล่าง'
              : 'ระบบทำงานผิดพลาดชั่วคราว กรุณาโหลดหน้านี้ใหม่อีกครั้ง'}
          </p>
          <button
            onClick={this.handleReload}
            style={{
              background: 'linear-gradient(135deg,#10b981,#0d9488)',
              color: '#fff',
              border: 0,
              borderRadius: 12,
              padding: '10px 22px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            }}
          >
            โหลดใหม่ / Reload
          </button>
        </div>
      </div>
    );
  }
}
