#!/bin/sh
set -e

PASS=true

# Check that no references to UserData remain in any file
for file in types.ts api.ts store.ts components.ts utils.ts; do
  if [ ! -f "$file" ]; then
    echo "FAIL: $file does not exist"
    PASS=false
    continue
  fi
  COUNT=$(grep -c 'UserData' "$file" || true)
  if [ "$COUNT" -gt 0 ]; then
    echo "FAIL: ${file} still contains ${COUNT} references to 'UserData'"
    PASS=false
  fi
done

# Count total UserProfile references (should be at least 10)
TOTAL=0
for file in types.ts api.ts store.ts components.ts utils.ts; do
  if [ -f "$file" ]; then
    COUNT=$(grep -c 'UserProfile' "$file" || true)
    TOTAL=$((TOTAL + COUNT))
  fi
done

if [ "$TOTAL" -lt 10 ]; then
  echo "FAIL: Expected at least 10 total UserProfile references, found ${TOTAL}"
  PASS=false
fi

# Check types.ts has the renamed interface
if ! grep -q 'interface UserProfile' types.ts; then
  echo "FAIL: types.ts missing 'interface UserProfile'"
  PASS=false
fi

# Check types.ts has renamed list type
if ! grep -q 'UserProfileList' types.ts || ! grep -q 'UserProfileResponse' types.ts; then
  echo "FAIL: types.ts should rename UserDataList->UserProfileList and UserDataResponse->UserProfileResponse"
  PASS=false
fi

# Check types.ts has renamed function
if ! grep -q 'createDefaultUserProfile' types.ts; then
  echo "FAIL: types.ts should rename createDefaultUserData->createDefaultUserProfile"
  PASS=false
fi

# Check store.ts has renamed class
if ! grep -q 'UserProfileStore' store.ts; then
  echo "FAIL: store.ts should rename UserDataStore->UserProfileStore"
  PASS=false
fi

# Check api.ts functions are renamed
for fn in fetchUserProfile fetchAllUserProfile updateUserProfile deleteUserProfile; do
  if ! grep -q "$fn" api.ts; then
    echo "FAIL: api.ts missing renamed function '${fn}'"
    PASS=false
  fi
done

# Check utils.ts functions are renamed
for fn in isValidUserProfile mergeUserProfile formatUserProfile sortUserProfile filterActiveUserProfile createTestUserProfile; do
  if ! grep -q "$fn" utils.ts; then
    echo "FAIL: utils.ts missing renamed function '${fn}'"
    PASS=false
  fi
done

if [ "$PASS" = false ]; then
  exit 1
fi

echo "PASS: all multi-file refactor checks passed"
exit 0
