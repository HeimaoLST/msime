# Agent Note: Android geometry contract follows extracted inset policy

Status: implemented

## Problem

The Android geometry contract check still required `Ui.bindPageBottomInsets` after the implementation moved that binding into `PageInsetsPolicy.bind`. The check therefore failed on the current `origin/develop` baseline and blocked every push touching Android.

## Decision

Update the contract check to validate `PageInsetsPolicy.bind`, its `WindowInsetsPolicy` delegation, and the two current callers. Keep the existing assertions that prevent duplicate listeners and obsolete `Ui` forwarders.

## Alternatives considered

Restoring the deleted `Ui` forwarding method would make the old check green but would undo the refactor and leave two possible owners for the same inset policy. Updating the check keeps the implementation boundary intact.

## Consequences

The contract now tracks the extracted policy and catches a future missing or duplicated page-inset binding. The check no longer blocks pushes because of a stale symbol name.

## Verification

The contract failed before the update and passes afterward with `python3 scripts/test-android-home-geometry-forwarders.py`; the Android host gate and repository quick gate are rerun before publishing the fix.
