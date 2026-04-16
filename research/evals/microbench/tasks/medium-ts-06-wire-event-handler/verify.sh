#!/bin/sh
set -e

# Check that EventBus is imported in user-service.ts
grep -q "import.*EventBus.*from.*event-bus\|import.*{.*EventBus.*}.*from" user-service.ts || \
  grep -q "require.*event-bus" user-service.ts || \
  { echo "FAIL: EventBus not imported in user-service.ts"; exit 1; }

# Check that user:created event is emitted
grep -q "user:created" user-service.ts || { echo "FAIL: 'user:created' event not found in user-service.ts"; exit 1; }

# Check that emit is called with user:created
grep -q "emit.*user:created\|emit.*'user:created'\|emit.*\"user:created\"" user-service.ts || \
  { echo "FAIL: emit not called with 'user:created'"; exit 1; }

# Check that user:deleted event is emitted
grep -q "user:deleted" user-service.ts || { echo "FAIL: 'user:deleted' event not found in user-service.ts"; exit 1; }

# Check that emit is called with user:deleted
grep -q "emit.*user:deleted\|emit.*'user:deleted'\|emit.*\"user:deleted\"" user-service.ts || \
  { echo "FAIL: emit not called with 'user:deleted'"; exit 1; }

echo "PASS"
exit 0
