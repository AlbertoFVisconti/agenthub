export const LOCAL_API_BASE = process.env.NEXT_PUBLIC_LOCAL_API_BASE || 'http://127.0.0.1:8080'
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://p01--agenthub--4cwccydynvym.code.run'
export const REMOTE_API_BASE = API_URL

export function loginWithGithub() {
  if (typeof window !== 'undefined' && (window as any).electron) {
    (window as any).electron.ipcRenderer.send('auth:login')
  } else {
    // Navigate directly to the API server to ensure the oauth_state cookie
    // is set on the exact same origin that GitHub will redirect back to.
    window.location.assign(`${API_URL}/auth/github`)
  }
}
