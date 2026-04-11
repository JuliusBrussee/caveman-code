#!/usr/bin/env bash
# codex-review.sh — Ralph adversarial review via Codex CLI
#
# Thin bash wrapper for direct shell/CI invocation outside Cave CLI.
# The real logic lives in the CaveKit extension (src/ralph/codex.ts).
#
# Usage:
#   source scripts/codex-review.sh
#   bp_codex_review --base main
#   bp_codex_review --base main --domain auth
#
# Prerequisites:
#   - codex CLI installed: npm i -g @openai/codex
#   - OPENAI_API_KEY set in environment

set -euo pipefail

FINDINGS_DIR="context/impl"
FINDINGS_FILE="${FINDINGS_DIR}/ralph-findings.md"

bp_codex_review() {
  local base="main"
  local domain=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --base)
        base="$2"
        shift 2
        ;;
      --domain)
        domain="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  # Preflight
  if ! command -v codex &>/dev/null; then
    echo "ERROR: codex CLI not found. Install: npm i -g @openai/codex" >&2
    return 1
  fi

  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    echo "WARNING: OPENAI_API_KEY not set. Codex may fail." >&2
  fi

  # Build kit context
  local kit_context=""
  if [[ -d "context/kits" ]]; then
    local kit_files
    if [[ -n "$domain" ]]; then
      kit_files=$(find context/kits -name "*${domain}*" -name "*.md" 2>/dev/null || true)
    else
      kit_files=$(find context/kits -name "*.md" 2>/dev/null || true)
    fi

    if [[ -n "$kit_files" ]]; then
      kit_context="Review against these acceptance criteria from kits:

"
      for f in $kit_files; do
        kit_context+="--- ${f} ---
$(cat "$f")

"
      done
    fi
  fi

  local prompt="You are Ralph — an adversarial code reviewer. Your job is to find what the builder missed.

Review the git diff from ${base} to HEAD.

${kit_context}
Rules:
1. Be thorough but fair — flag real issues, not style preferences
2. Assign severity: P0 (critical), P1 (high), P2 (medium), P3 (low)
3. Every finding must reference a specific file
4. Provide actionable suggestions

Output findings as a markdown table:
| Severity | File | Line | Finding | Suggestion |

If clean: \"No findings — clean pass.\"
End with: \"Summary: N findings (XC YH ZM WL)\""

  echo "Ralph reviewing diff from ${base}..." >&2

  # Run codex
  local output
  output=$(codex --approval-mode full-auto --quiet "$prompt" 2>/dev/null) || {
    echo "ERROR: Codex review failed (exit $?)" >&2
    return 1
  }

  # Write findings
  mkdir -p "$FINDINGS_DIR"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  if [[ ! -f "$FINDINGS_FILE" ]]; then
    echo "# Ralph Review Findings" > "$FINDINGS_FILE"
    echo "" >> "$FINDINGS_FILE"
  fi

  {
    echo "## Review — ${timestamp}"
    echo "**Base:** ${base}"
    echo ""
    echo "$output"
    echo ""
    echo "---"
    echo ""
  } >> "$FINDINGS_FILE"

  echo "$output"
  echo "" >&2
  echo "Findings appended to ${FINDINGS_FILE}" >&2
}

# Allow direct execution (not just sourcing)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  bp_codex_review "$@"
fi
