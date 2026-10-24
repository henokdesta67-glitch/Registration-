BRAINful HUB registration backend (Vercel + Supabase + Telegram)

FILES
- api/create-upload-url.js: securely creates a temporary signed upload permission for a receipt.
- api/register.js: verifies the uploaded receipt, saves registration details, and sends the receipt + details to Telegram.
- lib/supabase.js: server-only Supabase client.
- package.json: installs the Supabase library.

IMPORTANT SECURITY
- Never put SUPABASE_SERVICE_ROLE_KEY / sb_secret_... or TELEGRAM_BOT_TOKEN in index.html or GitHub.
- The payment-receipts bucket should remain PRIVATE.
- Do not send secrets to anyone in chat.
- This code does not verify that a payment is genuine; it only forwards the uploaded receipt for manual checking.

VERCEL ENVIRONMENT VARIABLES
SUPABASE_URL = https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY = your private Supabase secret key (sb_secret_... is accepted by the Supabase client)
TELEGRAM_BOT_TOKEN = token from BotFather
TELEGRAM_ADMIN_CHAT_ID = your numeric Telegram chat ID

After adding files and environment variables, redeploy the project.

SUPABASE SQL
Run this once in Supabase SQL Editor. It adds the fields used by this code:
alter table public.registrations
  add column if not exists telegram_username text,
  add column if not exists university text,
  add column if not exists course text;

Keep the bucket named exactly: payment-receipts
Keep it PRIVATE (Public bucket OFF).
Set the bucket's file size limit to 8 MB or higher and allowed MIME types to image/jpeg, image/png, image/webp.

NEXT: FRONTEND
The existing index.html must be updated to:
1. Load the Supabase JS v2 browser library.
2. Put your PUBLIC Supabase publishable key in the browser client only (it is designed to be public).
3. On submit, POST metadata to /api/create-upload-url, upload the receipt using uploadToSignedUrl, then POST the student fields and returned receipt path to /api/register.
Do not deploy the backend alone and expect the form to work; the frontend changes are required too.
