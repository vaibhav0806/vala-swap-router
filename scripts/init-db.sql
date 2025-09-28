-- Initialize database with extensions and basic setup
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create basic indexes for performance
-- These will be handled by TypeORM migrations, but having them here for reference
