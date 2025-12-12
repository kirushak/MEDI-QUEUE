CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialization TEXT,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,    -- e.g., room, equipment, nurse
  name TEXT NOT NULL,
  total_count INT NOT NULL DEFAULT 1 CHECK (total_count >= 0),
  available_count INT NOT NULL DEFAULT 1 CHECK (available_count >= 0),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slots (
  id SERIAL PRIMARY KEY,
  doctor_id INT REFERENCES doctors(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity >= 1),
  available_seats INT NOT NULL DEFAULT 1 CHECK (available_seats >= 0),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slot_resources (
  id SERIAL PRIMARY KEY,
  slot_id INT REFERENCES slots(id) ON DELETE CASCADE,
  resource_id INT REFERENCES resources(id) ON DELETE CASCADE,
  required_count INT NOT NULL DEFAULT 1 CHECK (required_count >= 1),
  UNIQUE (slot_id, resource_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  slot_id INT REFERENCES slots(id) ON DELETE CASCADE,
  user_id TEXT,
  seats INT NOT NULL CHECK (seats >= 1),
  status TEXT NOT NULL CHECK (status IN ('PENDING','CONFIRMED','FAILED','CANCELLED')),
  reserved_resources jsonb DEFAULT '{}'::jsonb, -- [{resource_id:1,count:1},...]
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_slots_doctor_start ON slots (doctor_id, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status_expires ON bookings (status, expires_at);
