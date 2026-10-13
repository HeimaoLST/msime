# Agent Note: statistics tab retries failed reads on return

Status: implemented

## Problem

`StatisticsFragment` only refreshed from `onBecameVisible()` when it already had a non-null statistics model. If the initial cross-process read failed, the model stayed null and returning to the tab never retried the read, leaving the empty-state message until the activity was recreated.

## Decision

Always call `reload()` when the kept-alive statistics tab becomes visible. `HostTask` already binds delivery to the current view, so the retry is safe across view recreation.

## Alternatives considered

Retrying only from the empty-state button would leave tab switches unable to recover. Recreating the fragment would discard the tab's selected section and violate the kept-alive tab design.

## Consequences

Returning to the statistics tab now recovers from transient store or cross-process failures without losing the selected section. A successful read still follows the existing rendering path.

## Verification

The lifecycle contract fails on the old guarded implementation and passes after the unconditional reload change; Android host and quick gates are run before publishing.
