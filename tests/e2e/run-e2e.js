// Simple e2e runner that hits a running local instance at PORT
const PORT = process.env.PORT || 3001;
const BASE = `http://localhost:${PORT}`;

async function testChatFaq() {
  const res = await fetch(`${BASE}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'dev-api-key'
    },
    body: JSON.stringify({ message: 'Quels sont vos délais de livraison ?' })
  });
  const json = await res.json();
  console.log('FAQ response:', json.answer ? 'OK' : 'NO_ANSWER');
}

async function testProductSearch() {
  const res = await fetch(`${BASE}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'dev-api-key'
    },
    body: JSON.stringify({ message: 'Je cherche un t-shirt ShopyVerse' })
  });
  const json = await res.json();
  console.log('Product response:', json.answer ? 'OK' : 'NO_ANSWER');
}

async function run() {
  console.log('Running E2E tests against', BASE);
  try {
    await testChatFaq();
    await testProductSearch();
    console.log('E2E tests complete');
    process.exit(0);
  } catch (err) {
    console.error('E2E tests failed', err);
    process.exit(1);
  }
}

run();
