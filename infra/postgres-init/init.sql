-- PostgreSQL init script: runs once when the data volume is empty.
-- Creates all databases needed by the platform.

-- Auth service database (already used by auth-service)
SELECT 'CREATE DATABASE authdb' WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'authdb'
)\gexec

-- Metrics service database
SELECT 'CREATE DATABASE metricsdb' WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'metricsdb'
)\gexec

-- Action service database
SELECT 'CREATE DATABASE actionsdb' WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'actionsdb'
)\gexec

-- Grant authuser full access to metricsdb so metrics-service can connect
-- and auto-create its tables on startup.
\connect metricsdb
GRANT ALL PRIVILEGES ON DATABASE metricsdb TO authuser;
GRANT ALL ON SCHEMA public TO authuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authuser;

-- Grant authuser full access to actionsdb so action-service can connect
-- and auto-create its tables on startup.
\connect actionsdb
GRANT ALL PRIVILEGES ON DATABASE actionsdb TO authuser;
GRANT ALL ON SCHEMA public TO authuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authuser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authuser;
