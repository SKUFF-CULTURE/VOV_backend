CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) UNIQUE,
  role VARCHAR(50),
  description TEXT,
  department_id INTEGER REFERENCES departments(id),
  google_id VARCHAR(255)
);