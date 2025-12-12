const db = require('./db');

async function processExpiredOnce() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query("SELECT id, reserved_resources::jsonb as reserved, slot_id, seats FROM bookings WHERE status = 'PENDING' AND expires_at <= now() FOR UPDATE SKIP LOCKED LIMIT 50");
    if (res.rowCount === 0) {
      await client.query('COMMIT');
      return 0;
    }

    for (const b of res.rows) {
      await client.query("UPDATE bookings SET status='FAILED' WHERE id=$1", [b.id]);
      const reserved = b.reserved || [];
      for (const r of reserved) {
        await client.query('UPDATE resources SET available_count = available_count + $1 WHERE id = $2', [r.count, r.resource_id]);
      }
      await client.query('UPDATE slots SET available_seats = available_seats + $1 WHERE id = $2', [b.seats, b.slot_id]);
    }

    await client.query('COMMIT');
    return res.rowCount;
  } catch (err) {
    await client.query('ROLLBACK').catch(()=>{});
    throw err;
  } finally {
    client.release();
  }
}

function startPolling(intervalMs) {
  setInterval(async () => {
    try {
      const processed = await processExpiredOnce();
      if (processed) console.log(`Expiry worker processed ${processed} bookings`);
    } catch (err) {
      console.error('expiry worker error', err);
    }
  }, intervalMs);
}

module.exports = { startPolling, processExpiredOnce };
