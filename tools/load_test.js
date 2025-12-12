const axios = require('axios');

async function stress(slotId = 1, total = 100, concurrency = 50) {
  const tasks = [];
  for (let i = 0; i < total; i++) {
    tasks.push(axios.post(`http://localhost:3000/slots/${slotId}/book`, { user_id: `user-${i}`, seats: 1 }).then(r => r.data).catch(e => ({ error: e.message, status: e.response?.status })));
    if (tasks.length >= concurrency) {
      const res = await Promise.all(tasks.splice(0, tasks.length));
      console.log('batch done', res.filter(x=>x.ok).length, 'ok');
    }
  }
  if (tasks.length) await Promise.all(tasks);
  console.log('done');
}

if (require.main === module) {
  const slot = parseInt(process.argv[2] || '1', 10);
  const total = parseInt(process.argv[3] || '200', 10);
  const concurrency = parseInt(process.argv[4] || '50', 10);
  stress(slot, total, concurrency).catch(console.error);
}
