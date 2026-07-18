# BoundaryCI Privacy Notice

Effective date: July 17, 2026

This notice explains how the BoundaryCI developer handles information when you use the BoundaryCI CLI, GitHub Action, or optional BoundaryCI Cloud public beta.

## Local deterministic scans

BoundaryCI does not require an account with the Developer. Deterministic scans run in your local environment or GitHub Actions runner and make no network requests. BoundaryCI has no telemetry, advertising, or analytics. The Developer does not receive your repository, migrations, findings, credentials, or workflow metadata merely because you run BoundaryCI. Information is sent to BoundaryCI Cloud only when you explicitly enable `--upload` or the equivalent GitHub Action input.

## Optional Fireworks review

The Fireworks review is disabled by default. If you enable it, BoundaryCI redacts common secret patterns locally and sends migration text directly to Fireworks using the API key and account you provide. The response returns to your environment. The Developer does not receive that request or response.

Fireworks acts under its own terms and privacy practices. You are responsible for deciding whether migration text may be sent to Fireworks and for configuring your Fireworks account appropriately. Do not enable the feature for material you are not authorized to submit.

## Optional BoundaryCI Cloud

BoundaryCI Cloud upload is disabled by default. When enabled, the CLI sends repository identity, commit and pull-request context, scan timestamps, database-profile and AI-review status, summary counts, and finding details. Finding details include relative file paths, line numbers, classifications, short evidence snippets, remediation text, disposition, and any waiver metadata.

Before upload, the CLI removes the absolute scan target and migration-file inventory, excludes local warning messages, normalizes finding paths, limits field sizes, and applies common token, JWT, password, secret, and API-key redaction. Complete migration files and database credentials are not part of the Cloud payload. Redaction cannot guarantee that every confidential value is removed. Do not enable Cloud upload unless you are authorized to send the resulting finding data.

Repository-bound ingestion tokens are used to authenticate uploads. BoundaryCI Cloud stores a SHA-256 hash rather than the plaintext token. Supabase hosts the public-beta control plane and processes the uploaded records on the Developer's behalf. Retention periods may be refined before general availability.

## Accounts and billing

BoundaryCI Cloud uses Supabase Auth to process account identifiers such as your email address and authentication records. Organization membership, repository configuration, plan, usage, and subscription status are stored to provide the Cloud service.

Stripe processes paid subscriptions, payment methods, invoices, tax identifiers, and billing addresses under Stripe's own privacy terms. BoundaryCI stores Stripe customer, subscription, and price identifiers plus subscription status and billing-period dates. The Developer does not receive or store your full payment-card number. Stripe sends signed webhook events to BoundaryCI so access and scan allowances remain synchronized with payment status.

## GitHub and npm

GitHub and npm may process information when they host the repository, run workflows, distribute releases, or serve the npm package. They do so under their own privacy notices. BoundaryCI does not provide scan information to a Developer-operated service unless Cloud upload is explicitly enabled.

## Information you choose to submit

If you open an issue, discussion, pull request, or vulnerability report, the Developer will use the information you submit to respond, maintain BoundaryCI, and address security concerns. GitHub stores that content under its own policies. Public submissions remain available with the repository unless removed by you or GitHub.

Never submit API keys, credentials, personal data, customer migrations, or other confidential material. Use GitHub's private vulnerability reporting for security-sensitive reports.

## Selling and sharing

The Developer does not sell personal information. The Developer does not share submitted information except as needed to provide BoundaryCI Cloud through service providers, respond through GitHub, comply with law, or protect rights or security.

## Retention and requests

Local-only BoundaryCI use stores no information with the Developer. Cloud scan history is retained according to the applicable public-beta or subscription plan and may be deleted earlier when an organization or repository is removed. Stripe controls payment-method and invoice retention in its systems. BoundaryCI may retain subscription identifiers, webhook event identifiers, and billing status records when reasonably necessary for accounting, fraud prevention, dispute handling, and legal compliance. For GitHub submissions, use GitHub's controls. For Cloud or support information, contact the Developer to request access, correction, export, or deletion.

## Changes and contact

Material changes to this notice will be committed to the public repository. Questions may be submitted at <https://github.com/sir-gig/boundaryci/issues> without including confidential information.
