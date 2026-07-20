# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability in BoundaryCI.

Use GitHub's private vulnerability reporting for this repository. Include the affected version, a minimal reproduction, the security impact, and any suggested remediation. You should receive an acknowledgement within three business days.

Never include production database credentials, user JWTs, Fireworks API keys, or customer migration files in a report unless they have been fully redacted.

## Supported versions

BoundaryCI is currently pre-1.0. Security fixes are applied to the latest tagged release. Users should pin an exact tag or commit and update promptly when a security release is published.

## Data boundary

Deterministic scans are local and make no network requests. Managed Fireworks review first checks paid-plan eligibility and explicit organization and repository authorization without sending migration content. Only after authorization does the runner send locally redacted migration text through BoundaryCI to Fireworks; BoundaryCI does not store that migration input. Direct `--fireworks` review instead uses the user's own Fireworks account. Secret redaction is defense-in-depth and is not a substitute for keeping credentials out of migrations.
