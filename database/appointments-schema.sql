-- Customer appointments (run on Supabase SQL editor or via app startup ensure)

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  reference_number VARCHAR(32) NOT NULL UNIQUE,
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  customer_email VARCHAR(120),
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(48) NOT NULL,
  service_type VARCHAR(80) NOT NULL DEFAULT 'consultation',
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
