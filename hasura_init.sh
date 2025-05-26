#!/bin/bash
# Script to set up Hasura migrations and metadata

# Install Hasura CLI if not installed
if ! command -v hasura &> /dev/null; then
  npm install -g hasura-cli
fi

# Start Docker Compose
docker-compose up --build -d

# Wait for Hasura
echo "Waiting for Hasura..."
until curl -s http://localhost:8080/healthz | grep -q "OK"; do
  sleep 2
done

# Initialize Hasura project if not exists
if [ ! -d "hasura" ]; then
  mkdir hasura
  cd hasura
  hasura init --endpoint http://localhost:8080 --admin-secret niggahasura
  cd ..
fi

# Create and apply migrations
hasura migrate create "init" --from-server
hasura migrate apply --all

# Export and apply metadata
hasura metadata export
hasura metadata apply

# Backup database
mkdir -p backups
docker exec postgres pg_dump -U postgres vov > backups/backup-$(date +%F).sql

echo "Hasura setup complete!"