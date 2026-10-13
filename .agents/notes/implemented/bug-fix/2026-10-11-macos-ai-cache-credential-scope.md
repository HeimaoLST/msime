# Agent Note: macOS AI candidate cache credential scope

Status: implemented

## Problem

macOS looked up AI candidates with a cache key built from the public query configuration before obtaining the credential-bearing provider descriptor. Rotating the token for the same endpoint and model could therefore reuse candidates fetched with the previous credential.

## Decision

Resolve the validated AI descriptor before consulting the cache. Add a SHA-256 scope digest of the complete descriptor to `MSIMEAICacheKey`; the digest distinguishes credentials and all other provider request settings without retaining the descriptor or its credentials in cache-key text. Keep the descriptor used for the cache lookup as the descriptor sent by the provider request.

## Alternatives considered

- Clear the process cache whenever preferences change: this misses changes made while no controller exists and requires every settings path to remember cache invalidation.
- Include only the endpoint, model, or a token prefix: each omits other descriptor changes or risks retaining credential material.
- Store the descriptor itself in the cache key: this would expose credentials in in-memory keys and diagnostics.

## Consequences

A credential rotation or any descriptor change causes a fresh AI request for the same query. Cache hits still bypass the 650 ms debounce, and the cache identity contains only a one-way digest of the descriptor.

## Verification

- `shortcut-test` regression coverage rotates a synthetic authorization token and asserts that the second generation creates a new AI batch instead of reusing the first result.
- `shortcut-test` cache-generation coverage accounts for descriptor resolution on every generation check.
- `git diff --check`
- `npm run verify-notes`
- `bash scripts/verify-local.sh --quick`
