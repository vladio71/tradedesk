-- Runs once, when the postgres container starts with an empty data volume.
-- One server, three databases. Each service owns exactly one of them.
CREATE DATABASE identity;
CREATE DATABASE wallet;
CREATE DATABASE market;
