-- Grant permissions to marshapp_user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO marshapp_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO marshapp_user;
GRANT USAGE ON SCHEMA public TO marshapp_user;
GRANT CREATE ON SCHEMA public TO marshapp_user;

-- Ensure the user can create tables (for TypeORM synchronize)
ALTER USER marshapp_user CREATEDB;