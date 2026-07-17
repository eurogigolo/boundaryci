# Security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability in BoundaryCI.

Use GitHub's private vulnerability reporting for this repository. Include the affected version, a minimal reproduction, the security impact, and any suggested remediation. You should receive an acknowledgement within three business days.

Never include production database credentials, user JWTs, Fireworks API keys, or customer migration files in a report unless they have been fully redacted.

## Supported versions

BoundaryCI is currently pre-1.0. Security fixes are applied to the latest tagged release. Users should pin an exact tag or commit and update promptly when a security release is published.

## Data boundary

Deterministic scans are local and make no network requests. The optional `--fireworks` review sends redacted migration text to Fireworks under the user's own account and data settings. Secret redaction is defense-in-depth and is not a substitute for keeping credentials out of migrations.
