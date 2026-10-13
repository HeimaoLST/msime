# Agent Note: invalidate pending clipboard image sends when the IME stops

Status: implemented

## Problem

Sending a recent clipboard image copies the source URI on a worker and commits it later on the main thread. Enabling privacy mode while that copy was running calls `stop(false)` to rebuild the Engine, but the old `clipboardImageGeneration` remained valid, so the completion could still commit an image after the privacy gate changed.

## Decision

Increment `clipboardImageGeneration` at the start of every `stop()` path. The existing completion check then discards the copied file and clears it instead of committing it to the current input connection.

## Alternatives considered

Incrementing only in `restartSessionForPrivacy()` would cover the reported path but leave other Engine teardown paths with the same stale asynchronous operation. Checking privacy only when the worker starts would still allow a mode change during the copy; centralizing invalidation at `stop()` covers both.

## Consequences

Any Engine teardown cancels an in-flight clipboard image commit. The next image action starts with the current input session and privacy state, while ordinary text clipboard behavior is unchanged.

## Verification

The lifecycle contract fails on the old implementation and passes after the generation increment. Android host compilation, JVM smokes, quick verification, and note validation are run before publishing.
