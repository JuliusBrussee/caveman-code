#!/bin/sh
set -e

PASS=true

# Check state-machine.ts exists
if [ ! -f "state-machine.ts" ]; then
  echo "FAIL: state-machine.ts does not exist"
  exit 1
fi

# Check StateMachine class is exported
if ! grep -q 'export.*class StateMachine' state-machine.ts; then
  echo "FAIL: state-machine.ts missing exported StateMachine class"
  PASS=false
fi

# Check it imports from types.ts
if ! grep -qE 'import.*from.*["\x27]\.\/types["\x27]' state-machine.ts; then
  echo "FAIL: state-machine.ts should import from types.ts"
  PASS=false
fi

# Check it has a send method
if ! grep -q 'send' state-machine.ts; then
  echo "FAIL: state-machine.ts missing send method"
  PASS=false
fi

# Check it has currentState property
if ! grep -q 'currentState' state-machine.ts; then
  echo "FAIL: state-machine.ts missing currentState property"
  PASS=false
fi

# Check transition logic is present (should reference valid states)
for state in Idle Loading Success Error; do
  if ! grep -q "$state" state-machine.ts; then
    echo "FAIL: state-machine.ts missing reference to state '${state}'"
    PASS=false
  fi
done

# Check throw on invalid transitions
if ! grep -q 'throw' state-machine.ts; then
  echo "FAIL: state-machine.ts should throw on invalid transitions"
  PASS=false
fi

# Check that transition logic handles all events
for event in Fetch Resolve Reject Reset; do
  if ! grep -q "$event" state-machine.ts; then
    echo "FAIL: state-machine.ts missing reference to event '${event}'"
    PASS=false
  fi
done

if [ "$PASS" = false ]; then
  exit 1
fi

echo "PASS: all state machine checks passed"
exit 0
