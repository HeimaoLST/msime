# Agent Note: Linux AI candidate cache is scoped to the validated private profile

Status: implemented

## Problem

`configured_ai` loaded the private AI configuration and then looked up the candidate cache before checking whether the selected profile matched the query's provider, endpoint, and model. The cache key contained only query fields, so a cached answer could survive a valid profile change and be returned after a token rotation. The same ordering made `ai_cache_only` probes observe the stale answer.

## Decision

`configured_ai` validates the selected private profile against the query before reading or writing the cache. A missing or mismatched profile returns no candidates and never reuses an old entry. Cache keys include a SHA-256 digest of the selected token when a validated profile is available; the token itself is never retained in the key. The existing provider, endpoint, model, prompt, context, limit, and pinyin identity fields remain unchanged.

## Alternatives considered

- **Clear the whole cache whenever the private configuration changes** — this would prevent stale reuse but requires tracking file changes and would evict unrelated valid entries. It also would not protect a cache-only probe between a change and the next reload.
- **Put the token in the cache key** — this directly separates credentials but retains a secret in process state and diagnostics that inspect keys. A one-way digest keeps the partition without retaining plaintext.
- **Only rely on `ai`'s existing profile check** — that check runs after cache lookup, so it cannot stop a stale cache hit. The validation must happen before the cache boundary.

## Consequences

Profile mismatches and credential rotations no longer return candidates generated under another private configuration. Cache-only probes follow the same configuration scope and remain local on a miss. Rotating a token creates an additional short-lived cache partition until normal bounded eviction; the cache key gains one fixed-size digest per entry and contains no credential text.

## Verification

`python3 platforms/linux/tests/candidate/ai_candidate_cache.py` passes all 24 tests, including regressions for profile mismatch and token rotation. `git diff --check` and `bash scripts/verify-local.sh --quick` are run before submission.
