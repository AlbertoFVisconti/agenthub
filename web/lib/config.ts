export const LOCAL_API_BASE = process.env.NEXT_PUBLIC_LOCAL_API_BASE || 'http://localhost:8080'
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://p01--agenthub--4cwccydynvym.code.run'
export const REMOTE_API_BASE = API_URL

export async function loginWithGithub() {
  if (typeof window !== 'undefined' && (window as any).electron) {
    try {
      await (window as any).electronAPI.login()
      window.location.reload()
    } catch (err) {
      console.error('Electron login failed:', err)
    }
  } else {
    // Navigate directly to the API server to ensure the oauth_state cookie
    // is set on the exact same origin that GitHub will redirect back to.
    window.location.assign(`${API_URL}/auth/github`)
  }
}
