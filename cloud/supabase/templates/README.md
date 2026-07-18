# BoundaryCI authentication email templates

These templates are the source of truth for the hosted Supabase Auth emails.
They use table-based layout and inline styles for broad email-client support,
load one first-party PNG brand mark from `boundaryci.com`, contain no tracking
elements, and keep security messages short and transactional.

## Hosted Supabase configuration

In **Authentication > Email > Templates**, configure:

| Supabase template | Subject | HTML source |
| --- | --- | --- |
| Confirm sign up | `Confirm your BoundaryCI account` | `confirmation.html` |
| Reset password | `Reset your BoundaryCI password` | `recovery.html` |
| Password changed | `Your BoundaryCI password was changed` | `password_changed_notification.html` |

Enable the **Password changed** security notification when installing its
template. Do not alter `{{ .ConfirmationURL }}` in the confirmation or recovery
templates; Supabase replaces it with the short-lived action URL.

In Resend, keep click tracking and open tracking disabled for
`auth.boundaryci.com`. Authentication links are single-use, and tracking link
rewrites can reduce deliverability or interfere with verification.

After any template change, send a confirmation and password-recovery message to
an inbox outside the Supabase project team. Confirm the message is delivered by
Resend, the button works, and the final redirect stays on
`https://boundaryci.com/`.
