const { app, session } = require('electron')

app.whenReady().then(async () => {
  const remoteApiBase = 'http://127.0.0.1:8081'
  const token = 'fake_jwt_token_12345'
  
  const cookie = {
    url: remoteApiBase,
    name: 'device_id',
    value: token,
    httpOnly: true,
    secure: remoteApiBase.startsWith('https'),
    sameSite: 'no_restriction',
    path: '/'
  }
  
  console.log('[ELECTRON AUTH] Attempting to set cookie:', cookie)
  
  try {
    await session.defaultSession.cookies.set(cookie)
    console.log('[ELECTRON AUTH] Successfully called cookies.set()')
    
    const verifyCookies = await session.defaultSession.cookies.get({ url: remoteApiBase })
    console.log(`[ELECTRON AUTH] Reading back cookies for ${remoteApiBase}:`, verifyCookies.map(c => c.name))
    
    if (verifyCookies.length === 0) {
      console.log('TRACE RESULT: The cookie was dropped by Chromium! sameSite="no_restriction" requires secure=true')
    }
  } catch (err) {
    console.error('Error:', err)
  }
  
  app.quit()
})
