# Nearly for two

This package adds Supabase email/password authentication, private two-person spaces, invitations, and shared persistence to Nearly. The frontend can run on GitHub Pages. The existing ChatGPT-hosted preview is a separate version.

## 1. Create your backend

1. Create a project at https://supabase.com/dashboard and keep its database password private.
2. Open SQL Editor, paste all of `supabase/setup.sql`, and run it once in a new project.
3. Under Authentication enable Email sign-in and email confirmation.
4. Find your Project URL and publishable key in the project connection/API settings.
5. Put those two public values into `config.js`. Never use the service_role key or database password in frontend files.

The database table has Row Level Security enabled and direct access revoked. The RPC function checks the authenticated user and space membership. Invitation codes expire after seven days and are consumed on joining. Shared writes use revision checks. On a conflict, export your pending edits, load the latest shared version, and reapply the change.

## 2. Publish using GitHub Pages

1. Create a GitHub repository named `nearly`.
2. Upload the CONTENTS of this folder to its root. `index.html`, `app.js`, `backend.js`, `config.js`, and `style.css` must be at the root.
3. In the repository open Settings → Pages.
4. Choose Deploy from a branch, select `main` and `/ (root)`, and save.
5. Open the exact website URL GitHub displays after deployment.
6. In Supabase Authentication → URL Configuration, set Site URL to that exact URL and add it to the redirect allow list.

The publishable key is designed for frontend use. Account passwords, database passwords, and service role keys must remain private. Application records live in Supabase.

## 3. Start using it together

1. Open the website and create your account using your email and a password of at least eight characters.
2. Confirm your email and sign in on the website.
3. Click Create our space.
4. Copy the invitation code from Account & pairing and send it privately to your partner.
5. Your partner opens the same website, creates and confirms their own account, signs in, pastes the invitation, and chooses Join their space.
6. Update your names and time zones in Settings.
7. Send a message, add a memory, create a wish or reunion date. The other device refreshes its shared view approximately every three seconds when no dialog is open.

Use Account & pairing to sign out, renew an unused invitation, or leave. Leaving removes your future access. The remaining partner retains shared records. Leaving as the sole member deletes that space. Export before leaving if you want a copy.

## Local development on Windows

Extract this ZIP to `E:\Projects\nearly`. Open that folder in VS Code and use Live Server, or run `py -m http.server 8000` from the folder and open http://localhost:8000. Add the development URL to Supabase's auth redirect allow list if testing email links locally.

## Implemented scope and remaining work

Shared messages, memories including small images, letters, wish lists, garden, reunion date, plans, and settings persist in the backend. Daily Spark currently uses one shared answer shown immediately. Both members can edit shared records. Messages currently use a shared authorless thread. Games and drawing work on one device and can save their results as shared memories. Live remote game rooms, separate hidden daily answers, author-specific edit restrictions, push/email notifications, password recovery UI, PWA offline support, and the rest of the full PRD remain future work.

Scheduled letters have a visual date gate only. Their content is already in the shared data and can be read by either member using developer tools. Photos are limited to 1 MB each and the shared document to 8 MB. This first backend uses one shared document with conflict detection, so simultaneous saves may require reapplying a change. Failed writes show an error with an export option. Shared data is fetched in full after each poll and must be kept small.

JavaScript syntax checks passed. Hosted authentication, SQL execution, authorization and two-account synchronization have not been verified because no Supabase project credentials were supplied. Before adding personal content, use two test accounts to confirm joining, cross-device updates, conflict handling, access rejection for an unrelated third account, and removal of access after leaving.
