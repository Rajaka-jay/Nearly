# Nearly partner chat

Open **Messages → Chat**. Each partner uses their own paired account. Messages have separate incoming/outgoing bubbles, server timestamps, server-confirmed Sent labels, read acknowledgements, replies, emoji selection, search within loaded history, and earlier-message pagination. Failed messages remain in the open app with Retry and Edit controls. Unsent drafts survive navigation within the current app document; they are not persisted after reload. Calls open from the conversation header.

**Message options → Delete for me** hides a message only for the signed-in account and offers Undo. **Delete for everyone** is allowed only for the sender, clears the message body on the server, and leaves a placeholder. **Chat options → Clear my chat** hides messages up to the confirmation's cutoff only for the signed-in user. It preserves the partner's copy and messages arriving after that cutoff.

Existing messages from the earlier shared JSON implementation have no verifiable sender, so they remain read-only under **Earlier conversation**. Clear my chat also hides this section for that user. No ownership is invented or reassigned.

Apply `supabase/chat.sql` once to the existing Nearly Supabase project. It creates the authenticated `nearly_chat` RPC and RLS-protected message, preference and per-user hiding tables. Every action derives the authenticated user and current pair from `nearly_spaces`, not client-supplied identity. A former or newly connected partner cannot access the previous pair's messages. Direct client writes and anonymous RPC access are revoked. The SECURITY DEFINER API is intentional: it performs these authorization checks before every write.

Realtime update notifications have a three-second polling recovery path. Typing expires server-side; the UI never fabricates online status. Read labels are based on acknowledgements sent when the conversation is focused, visible, and scrolled to the latest messages. Browser notifications reuse the existing opt-in and show generic text. No end-to-end encryption claim is made.

Run `npm run check` and `npm test`. `tests/chat.mjs` tests private access, authorship, duplicate requests, read receipts, reply validation, deletion permissions, per-user clear/hide, messages arriving during clear confirmation, pagination and membership changes using PostgreSQL-compatible PGlite. A local sample-data fixture was used for browser interface checks; no real couple messages were sent or deleted during verification.
