# Agent Note: Windows AI provider request wiring

Status: implemented

## Problem

Windows submitted the raw Engine online query to `AiCandidateWorker`, which rebuilt an AI descriptor from that query. The Engine field is `pinyin_segments`, while the worker read the nonexistent `segmented_pinyin`, so the shared AI request validator rejected every normal Windows AI request. Rebuilding the descriptor also bypassed the session-owned credential resolution.

## Root cause

`FocusedSession::attach_online_query` already produced `PendingReply::ai_request` through the host session, but `SessionController` ignored it and called `AiCandidateWorker::submit` with only the online query. The worker's cache identity likewise omitted the resolved descriptor, allowing a credential or endpoint change to reuse an old answer.

## Decision

Pass the bounded, host-generated descriptor into the worker. The worker parses that descriptor for transport, derives the candidate limit from the query, and hashes the descriptor into the cache identity without retaining its credentials in the key. Empty descriptors still resolve the AI seat without issuing network traffic.

## Alternatives considered

- Rebuild the descriptor in the worker with a corrected field name: this would still duplicate credential resolution and could drift from the session's current preferences.
- Keep the old query-only cache key: this would reuse a result after an endpoint or credential change.

## Consequences

Windows AI requests now use the same host-owned credential and segmentation mapping as the other hosts. Descriptor hashes add a cache identity component without retaining credentials in cache-key text.

## Verification

- Added Windows AI worker regression coverage for descriptor forwarding and descriptor changes bypassing the cache.
- Before the cache identity fix, Wine reported `FAIL windows-ai-candidate-worker` on the descriptor-change assertion.
- `bash platforms/windows/build-cross-container.sh x64` passed.
- Targeted Wine execution of `windows-ai-candidate-worker.exe` passed: `Windows AI candidate worker checks passed`.
- `git diff --check`

## Limitations

The full Wine suite has unrelated baseline failures (`windows-maintenance-hotkeys`, `windows-server-smoke`, several TSF/UI probes, and `rust-send_input_marker`); the targeted worker passed after this fix.
