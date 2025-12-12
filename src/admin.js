const express = require('express');
const db = require('./db');
const router = express.Router();

router.post('/doctors', async (req, res) => {
  const { name, specialization } = req.body;
  const r = await db.query('INSERT INTO doctors (name, specialization) VALUES ($1,$2) RETURNING *', [name, specialization]);
  res.json(r.rows[0]);
});

router.post('/resources', async (req, res) => {
  const { type, name, total_count } = req.body;
  const r = await db.query('INSERT INTO resources (type, name, total_count, available_count) VALUES ($1,$2,$3,$3) RETURNING *', [type, name, total_count||1]);
  res.json(r.rows[0]);
});

router.post('/slots', async (req, res) => {
  const { doctor_id, start_time, end_time, capacity } = req.body;
  const r = await db.query('INSERT INTO slots (doctor_id, start_time, end_time, capacity, available_seats) VALUES ($1,$2,$3,$4,$4) RETURNING *', [doctor_id, start_time, end_time, capacity||1]);
  res.json(r.rows[0]);
});

router.post('/slots/:id/resources', async (req, res) => {
  const slotId = parseInt(req.params.id,10);
  const { resource_id, required_count } = req.body;
  await db.query('INSERT INTO slot_resources (slot_id, resource_id, required_count) VALUES ($1,$2,$3) ON CONFLICT (slot_id, resource_id) DO UPDATE SET required_count = EXCLUDED.required_count', [slotId, resource_id, required_count || 1]);
  res.json({ ok: true });
});

module.exports = router;
