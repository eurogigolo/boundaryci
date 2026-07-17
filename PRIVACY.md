# BoundaryCI Privacy Notice

Effective date: July 17, 2026

This notice explains how the BoundaryCI developer handles information when you use the BoundaryCI CLI or GitHub Action.

## Local deterministic scans

BoundaryCI does not require an account with the Developer. Deterministic scans run in your local environment or GitHub Actions runner and make no network requests. BoundaryCI has no telemetry, advertising, analytics, or Developer-operated collection endpoint. The Developer does not receive your repository, migrations, findings, credentials, or workflow metadata merely because you run BoundaryCI.

## Optional Fireworks review

The Fireworks review is disabled by default. If you enable it, BoundaryCI redacts common secret patterns locally and sends migration text directly to Fireworks using the API key and account you provide. The response returns to your environment. The Developer does not receive that request or response.

Fireworks acts under its own terms and privacy practices. You are responsible for deciding whether migration text may be sent to Fireworks and for configuring your Fireworks account appropriately. Do not enable the feature for material you are not authorized to submit.

## GitHub and npm

GitHub and npm may process information when they host the repository, run workflows, distribute releases, or serve the npm package. They do so under their own privacy notices. BoundaryCI does not provide that information to a separate Developer-operated service.

## Information you choose to submit

If you open an issue, discussion, pull request, or vulnerability report, the Developer will use the information you submit to respond, maintain BoundaryCI, and address security concerns. GitHub stores that content under its own policies. Public submissions remain available with the repository unless removed by you or GitHub.

Never submit API keys, credentials, personal data, customer migrations, or other confidential material. Use GitHub's private vulnerability reporting for security-sensitive reports.

## Selling and sharing

The Developer does not sell personal information. The Developer does not share submitted information except as needed to respond through GitHub, comply with law, protect rights or security, or use service providers operating under their own terms.

## Retention and requests

BoundaryCI itself stores no information with the Developer. For information you voluntarily submit through GitHub, use GitHub's controls or contact the Developer through a repository issue to request correction or deletion. Legal and security records may be retained when reasonably necessary.

## Changes and contact

Material changes to this notice will be committed to the public repository. Questions may be submitted at <https://github.com/sir-gig/boundaryci/issues> without including confidential information.
