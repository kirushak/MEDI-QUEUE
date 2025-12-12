const db = require('./db');
const { v4: uuidv4 } = require('uuid');

async function attemptBooking({ slotId, userId, seats = 1 }) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const slotRes = await client.query('SELECT id, available_seats FROM slots WHERE id = $1 FOR UPDATE', [slotId]);
    if (slotRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'slot_not_found' };
    }
    const slot = slotRes.rows[0];
    if (slot.available_seats < seats) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_enough_seats' };
    }

    const reqRes = await client.query('SELECT sr.resource_id, sr.required_count, r.available_count FROM slot_resources sr JOIN resources r ON r.id = sr.resource_id WHERE sr.slot_id = $1 ORDER BY sr.resource_id FOR UPDATE', [slotId]);

    const insufficient = reqRes.rows.find(r => (r.available_count < r.required_count * seats));
    if (insufficient) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'resource_unavailable', resource_id: insufficient.resource_id };
    }

    await client.query('UPDATE slots SET available_seats = available_seats - $1 WHERE id = $2', [seats, slotId]);

    const reserved = [];
    for (const r of reqRes.rows) {
      const dec = r.required_count * seats;
      await client.query('UPDATE resources SET available_count = available_count - $1 WHERE id = $2', [dec, r.resource_id]);
      reserved.push({ resource_id: r.resource_id, count: dec });
    }

    const bookingId = uuidv4();
    const expiresAt = new Date(Date.now() + (parseInt(process.env.BOOKING_EXPIRY_SECONDS || '120', 10) * 1000)).toISOString();
    await client.query('INSERT INTO bookings (id, slot_id, user_id, seats, status, reserved_resources, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [bookingId, slotId, userId, seats, 'PENDING', JSON.stringify(reserved), expiresAt]);

    await client.query('COMMIT');
    return { ok: true, booking_id: bookingId, status: 'PENDING', expires_at: expiresAt };
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    throw err;
  } finally {
    client.release();
  }
}

async function confirmBooking(bookingId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query('SELECT id, status FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (b.rowCount === 0) { await client.query('ROLLBACK'); return { ok: false, reason: 'not_found' }; }
    if (b.rows[0].status !== 'PENDING') { await client.query('ROLLBACK'); return { ok: false, reason: 'invalid_state' }; }
    await client.query('UPDATE bookings SET status = $1 WHERE id = $2', ['CONFIRMED', bookingId]);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    throw err;
  } finally {
    client.release();
  }
}

async function cancelBooking(bookingId) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query('SELECT id, status, reserved_resources::jsonb as reserved, slot_id, seats FROM bookings WHERE id = $1 FOR UPDATE', [bookingId]);
    if (b.rowCount === 0) { await client.query('ROLLBACK'); return { ok: false, reason: 'not_found' }; }
    const booking = b.rows[0];
    if (booking.status === 'CANCELLED') { await client.query('ROLLBACK'); return { ok: false, reason: 'already_cancelled' }; }

    await client.query('UPDATE bookings SET status = $1 WHERE id = $2', ['CANCELLED', bookingId]);

    const reserved = booking.reserved || [];
    for (const r of reserved) {
      await client.query('UPDATE resources SET available_count = available_count + $1 WHERE id = $2', [r.count, r.resource_id]);
    }
    await client.query('UPDATE slots SET available_seats = available_seats + $1 WHERE id = $2', [booking.seats, booking.slot_id]);

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { attemptBooking, confirmBooking, cancelBooking };
