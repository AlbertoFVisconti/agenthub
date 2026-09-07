const http = require('http');

async function run() {
  // 1. Get anonymous session
  console.log('Fetching anonymous session...');
  const res1 = await fetch('http://127.0.0.1:8081/auth/me');
  const cookie = res1.headers.get('set-cookie').split(';')[0];
  console.log('Cookie:', cookie);

  // 2. Get tools
  const res2 = await fetch('http://127.0.0.1:8081/marketplace/tools');
  const data2 = await res2.json();
  const wordCounter = data2.tools.find(t => t.name === 'word-counter' || t.slug === 'word-counter' || t.name === 'count_words');
  console.log('Tool ID:', wordCounter?.id);

  if (wordCounter) {
    // 3. Install tool
    console.log('Installing tool...');
    const res3 = await fetch('http://127.0.0.1:8081/marketplace/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie
      },
      body: JSON.stringify({ toolId: wordCounter.id })
    });
    console.log('Install status:', res3.status);
  }

  // 4. Send chat message to desktop API
  console.log('Sending chat message to Desktop API...');
  const res4 = await fetch('http://127.0.0.1:8080/models/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie,
      'Authorization': 'Bearer test'
    },
    body: JSON.stringify({
      provider: 'openai',
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'test' }],
      workspacePath: 'C:\\Users\\alber\\Desktop\\tools-marketplace\\test-agent'
    })
  });
  
  const text = await res4.text();
  console.log('Chat response status:', res4.status);
  console.log('Chat response body snippet:', text.slice(0, 100));
}

run().catch(console.error);
