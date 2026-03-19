# Resetting a user so they can sign up again

If someone signed up when the confirmation email redirected to localhost (or their account is stuck), you can remove their auth and profile data so they can sign up again with the **same email**.

**Their contact log is not deleted.** The `contacts` table is keyed by callsign, not by user id. Only their auth account and profile (callsign preference, display settings) are removed. Any contacts they uploaded (ADIF or via the client) stay in the database. After they re-sign up and set their callsign again, those contacts will still appear under “My Personal Log”.

## Option 1: Supabase Dashboard (simplest)

1. **Supabase Dashboard** → your project → **Authentication** → **Users**.
2. Find the user by **email** (search or scroll).
3. Open the user row (click the email or the ⋮ menu).
4. Click **Delete user** and confirm.

**If you get an error** (e.g. foreign key from `clubs`), use Option 2 first to unlink any clubs they own, then delete the user again from the Dashboard.

---

## Option 2: Unlink clubs then delete (if they own clubs)

If the user owns any **clubs**, the database will block deleting their profile until those clubs no longer point to them. Run this in **SQL Editor** (replace the email), then delete the user in the Dashboard as in Option 1.

```sql
-- Replace 'their-email@example.com' with the actual email
DO $$
DECLARE
  _uid uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = 'their-email@example.com';
  IF _uid IS NOT NULL THEN
    -- Unlink clubs they own (club stays, owner becomes null)
    UPDATE public.clubs SET owner_id = NULL WHERE owner_id = _uid;
    -- Profile will be removed when you delete the user in the Dashboard
    RAISE NOTICE 'Clubs unlinked for user %. Now delete this user in Authentication → Users.', _uid;
  ELSE
    RAISE NOTICE 'No user found with that email.';
  END IF;
END $$;
```

Then go to **Authentication** → **Users**, find that email, and **Delete user**.

---

## After cleanup

- The person can go to your app and **Sign up** again with the **same email**.
- They will receive a new confirmation email; with the fix in place, the link will go to your production URL, not localhost.

---

## Message you can send them

You can send something like this:

---

**Subject: QSOlive – please sign up again**

Hi,

We had a short-lived issue where the account confirmation email sent some people to the wrong link. We’ve fixed that.

We’ve cleared your previous signup so you can register again:

1. Go to [your QSOlive URL].
2. Click **Sign in** (or the sign-in option).
3. Choose **Sign up** and enter your email and a password.
4. Check your inbox (and spam) for the confirmation email and click the link in it.
5. You should land back on the app and be signed in.

If you don’t see the email, wait a few minutes and check spam. If it still doesn’t arrive, reply to this message and we’ll look into it.

Thanks,  
[Your name]

---
