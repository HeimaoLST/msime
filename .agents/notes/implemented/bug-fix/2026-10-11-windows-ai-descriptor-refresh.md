# Agent Note: Windows AI descriptor refresh at dispatch

Status: implemented

## Problem

Windows copied the host-generated AI HTTP descriptor into the key reply. A preferences update could be published after that reply was composed but before it was delivered, so the worker could still send credentials and model settings from the old snapshot.

## Root cause

`FocusedSession::attach_online_query` resolved `ai_request` while composing the key, and `SessionController` submitted that copied descriptor after delivery. The host API already validates descriptors against current session preferences, but the late submission bypassed that check.

## Decision

Keep only the bounded online query in `PendingReply`. After delivery, enqueue a short input-queue task that calls `ServerSession::ai_request` immediately before `AiCandidateWorker::submit`. If the queue is full, submit an empty descriptor so the worker resolves the AI seat without sending a stale request.

## Alternatives considered

- Keep the early descriptor and compare preference revisions in the controller: this duplicates host-session validity rules and can still race a later publication.
- Rebuild the descriptor on the worker thread: the worker does not own the session and cannot safely read its preferences.

## Consequences

AI network requests use the preferences and credentials current at dispatch time. A queue admission failure produces the normal unavailable AI seat rather than sending an old descriptor.

## Verification

- `bash platforms/windows/build-cross-container.sh x64` passed.
- `git diff --check` passed.
- The targeted `windows-ai-candidate-worker` Wine test from the preceding descriptor wiring fix remains green; this change only moves descriptor generation to the queue-owned dispatch point.
