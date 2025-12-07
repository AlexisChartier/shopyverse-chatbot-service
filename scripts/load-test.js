const autocannon = await import('autocannon');

const url = process.env.LOAD_URL || 'http://localhost:3001/api/v1/chat';

async function run() {
  console.log('Starting load test against', url);
  const result = await autocannon.default({
    url,
    connections: 50,
    duration: 20,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'dev-api-key'
    },
    body: JSON.stringify({ message: 'Je cherche un t-shirt en coton' })
  });

  console.log('Load test complete');
  console.log(result);
}

run().catch((e) => {
  console.error('Load test failed', e);
  process.exit(1);
});
