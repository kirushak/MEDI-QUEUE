require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('./admin');
const { attemptBooking, confirmBooking, cancelBooking } = require('./booking');
const { redis } = require('./kb_cache');
const db = require('./db');
const { startPolling } = require('./worker_expiry');

const app = express();
app.use(bodyParser.json());

app.use('/admin', admin);

app.get('/slots', async (req, res) => {
  const cacheKey = 'mediqueue:slots';
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const r = await db.query('SELECT s.id, s.doctor_id, d.name as doctor_name, s.start_time, s.end_time, s.capacity, s.available_seats FROM slots s JOIN doctors d ON d.id = s.doctor_id WHERE s.start_time >= now() ORDER BY s.start_time');
  const rows = r.rows;
  await redis.set(cacheKey, JSON.stringify(rows), 'EX', parseInt(process.env.SLOT_LIST_CACHE_TTL || '30', 10));
  res.json(rows);
});

app.post('/slots/:id/book', async (req, res) => {
  try {
    const slotId = parseInt(req.params.id, 10);
    const { user_id, seats } = req.body;
    const out = await attemptBooking({ slotId, userId: user_id, seats: seats || 1 });
    res.json(out);
  } catch (err) {
    console.error('booking error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/bookings/:id/confirm', async (req, res) => {
  const bookingId = req.params.id;
  try {
    const out = await confirmBooking(bookingId);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/bookings/:id/cancel', async (req, res) => {
  try {
    const out = await cancelBooking(req.params.id);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
});

app.get('/bookings/:id', async (req, res) => {
  const r = await db.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
  if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('MediQueue listening', port);
  const pollInterval = parseInt(process.env.EXPIRY_POLL_INTERVAL || '5000', 10);
  startPolling(pollInterval);
});
