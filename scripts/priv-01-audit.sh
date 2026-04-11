#!/usr/bin/env bash
# PRIV-01 audit — fails if student identifiers leak into LLM prompt builders.
#
# Source of truth:
#   .planning/phases/08-root-cause-theme-diagnosis-and-teacher-remediation/08-RESEARCH.md §B5
#   .planning/phases/08-root-cause-theme-diagnosis-and-teacher-remediation/08-CONTEXT.md D-13
#
# Usage:
#   bash scripts/priv-01-audit.sh
#
# Exit codes:
#   0 — PASSED (no PII tokens in prompt builder files)
#   1 — FAILED (prompt builder contains a forbidden identifier token)
#
# Design:
#   - PROMPT_FILES are scanned STRICTLY: any match of
#       \b(email|studentId|userId|enrollment)\b
#     outside a comment line fails the audit.
#   - The `name` token is intentionally excluded from the strict pattern so that
#     legitimate uses like `theme.name` (theme names are public library data)
#     pass. PII-style `name` leaks on prompt builders would appear as
#     `studentName`, `email`, etc., and are caught by the word-boundary tokens.
#   - ACTION_FILES are scanned INFORMATIONALLY: matches are printed for
#     reviewer attention but do NOT fail the audit. Authoritative structural
#     guard for actions lives in apps/web/__tests__/actions/themes.test.ts.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PROMPT_FILES=(
  "packages/llm/src/prompts/analyze-student-themes.ts"
  "packages/llm/src/prompts/generate-lesson-plan.ts"
)

ACTION_FILES=(
  "apps/web/actions/themes.ts"
)

STRICT_PATTERN='\b(email|studentId|userId|enrollment)\b'
INFO_PATTERN='\b(email|studentId|userId)\b'

fail=0

echo "PRIV-01 audit: scanning prompt builders (strict)..."
for f in "${PROMPT_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "  SKIP (file not found): $f"
    continue
  fi
  # Strip line-comments (// ...), block-comment lines starting with ` *`, and
  # block-comment openers (/* ...). Everything that survives is "live code".
  hits=$(sed -E '/^[[:space:]]*\/\//d; /^[[:space:]]*\*/d; /^[[:space:]]*\/\*/d' "$f" | grep -nE "$STRICT_PATTERN" || true)
  if [[ -n "$hits" ]]; then
    echo "  FAIL: $f"
    echo "$hits" | sed 's/^/    /'
    fail=1
  else
    echo "  OK:   $f"
  fi
done

echo ""
echo "PRIV-01 audit: scanning server actions for identifier leaks (informational)..."
for f in "${ACTION_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "  SKIP (file not found): $f"
    continue
  fi
  hits=$(grep -nE "$INFO_PATTERN" "$f" || true)
  if [[ -n "$hits" ]]; then
    echo "  INFO: $f references identifiers (must only be in auth/ownership checks):"
    echo "$hits" | sed 's/^/    /'
  else
    echo "  OK:   $f"
  fi
done

if [[ $fail -ne 0 ]]; then
  echo ""
  echo "PRIV-01 audit FAILED — student identifiers found in prompt builder code."
  exit 1
fi

echo ""
echo "PRIV-01 audit PASSED."
