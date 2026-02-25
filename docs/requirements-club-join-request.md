# Design: Request to Join Club

This document defines the **design** for allowing a **user** to request addition into a **club**. The request is sent to the club’s **manager** (owner and/or club managers), including delivery via **email**.

**Related:** [Requirements: Settings & Club Admin](requirements-settings-club-admin.md), [Database Setup](database-setup.md).

---

## 1. Goal and scope

- **Goal:** Any user (logged-in or optionally anonymous) can submit a **request to join** a club. The request is delivered to the **manager** of that club (e.g. by email) so they can add the requester’s callsign to the roster (via Club Admin).
- **Out of scope for this design:** Automatic approval, invite-by-link, or in-app “approve/deny” UI (can be added later).

---

## 2. Who is the “manager”?

- **Primary:** The club **owner** (`clubs.owner_id` → `profiles.id`). Owner’s `profiles.email` is used for notification.
- **Optional (future):** If `club_managers` is used, requests can be sent to **all** managers (owner + rows in `club_managers`). For simplicity, **Phase 1** can notify only the owner; Phase 2 can CC or also notify club managers.

---

## 3. User flow (high level)

1. User **discovers** a club (e.g. from a “Clubs” / “Find a club” list, or from Settings when choosing a club).
2. User opens a **“Request to join this club”** action (link or button).
3. User fills a **form** (see below) and submits.
4. System **sends the request** to the club manager (e.g. email); optionally stores the request in the DB for future “Pending requests” in Club Admin.
5. Manager receives the request (email) and can **add the callsign** to the roster in Club Admin (existing flow).

---

## 4. Where the feature appears in the UI

Two entry points (both can be supported):

| Location | Description |
|----------|-------------|
| **A. Clubs / Find a club page** | New page or section that lists **all clubs** (or public clubs). Each club row has a “Request to join” button. User selects a club and opens the request form (same form as below). |
| **B. Settings (Display Configuration)** | When mode is “One Club” or “Multiple Clubs”, next to the club dropdown/checkboxes, show a link **“Request to join a club”** that opens a modal or navigates to a small form: “Select club” + request form. Alternatively, per-club: when user has selected a club they are **not** in the roster of, show “Not in roster? [Request to join this club]”. |

**Recommendation:** Start with **B** (Settings) for minimal UI surface: add a single “Request to join a club” link that opens a flow: choose club → request form. Optionally add **A** later for discoverability.

---

## 5. Request form

**Fields:**

| Field | Required | Notes |
|-------|----------|--------|
| **Club** | Yes | Dropdown or pre-selected from context (e.g. from “Request to join [Club X]”). |
| **Callsign** | Yes | The callsign the user wants added to the roster (e.g. `W1ABC`). If logged-in, default to `profiles.callsign` and allow edit. |
| **Message (optional)** | No | Short message to the manager (e.g. “I’m the club secretary, please add me.”). |

**If we allow unauthenticated requests (optional):**

| Field | Required | Notes |
|-------|----------|--------|
| **Your name** | Optional | For the email body. |
| **Your email** | Optional | So the manager can reply. |

**Recommendation:** **Phase 1:** Require **logged-in** user; use `profiles.callsign` as default and `profiles.email` for “requester email” in the notification. No new “your name/email” fields. **Phase 2:** Optional “guest” request form with name/email.

---

## 6. Delivering the request to the manager (email)

- **Recipient:** Club owner’s email from `profiles`: join `clubs` on `owner_id` → `profiles.id`, select `profiles.email` for that club. If `profiles.email` is null, we can skip email or show a message “This club has no contact email configured.”
- **Content (suggested):**
  - Subject: e.g. `[QSOlive] Join request for club “[Club Name]”`
  - Body: Requester callsign, optional message, and “Add this callsign in Club Admin: [link to app].”
- **Implementation options:**
  - **Option 1 – Backend only:** Supabase Edge Function or a small backend service that sends email (e.g. Resend, SendGrid, or Supabase Auth’s email if we repurpose it). Frontend calls the function with `club_id`, `callsign`, `message`; function looks up owner email and sends.
  - **Option 2 – Client-side mailto:** Frontend opens `mailto:owner@example.com?subject=...&body=...` with pre-filled subject and body. No backend needed; works even without an email service. Manager gets the request in their mail client.
- **Recommendation:** **Phase 1:** Use **mailto** so we don’t depend on an email API. Frontend fetches club name and owner email (or a “contact_email” if we add it), and opens `mailto` with subject/body. If owner has no email, show: “No contact email for this club. Please contact the club directly.”

---

## 7. Optional: Store requests in the database

For a later “Pending requests” section in Club Admin (manager sees list and can approve/deny in-app), we can add a table:

**Table: `club_join_requests` (optional, Phase 2)**

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | |
| `club_id` | uuid, FK → clubs(id) | |
| `callsign` | text | Requested callsign |
| `requester_id` | uuid, nullable, FK → profiles(id) | If logged-in |
| `message` | text, nullable | Optional message |
| `status` | text | e.g. `pending`, `approved`, `rejected` |
| `created_at` | timestamptz | |
| `reviewed_at` | timestamptz, nullable | |
| `reviewed_by` | uuid, nullable, FK → profiles(id) | |

- RLS: Anyone can insert (or only authenticated); only club owner (and master_admin / club_managers) can update/select for their clubs.
- Club Admin UI: New section “Pending requests” for the selected club; “Approve” adds callsign to `club_roster` and marks request approved.

**Recommendation:** Omit this table in **Phase 1**; deliver only via email. Add `club_join_requests` and in-app approval when we implement Phase 2.

---

## 8. Data and RLS (Phase 1 – email only)

- **Read:** Frontend needs club list (already public) and, for the chosen club, the **owner’s email** (or a contact email). Today `profiles` is publicly readable, so we can `select profiles.email` joined from `clubs` where `clubs.owner_id = profiles.id`. If we prefer not to expose owner email to all clients, we can add a Supabase Edge Function that accepts `club_id` and returns only “contact email” or sends the email server-side.
- **Write:** No new tables in Phase 1; no DB write for the request.

---

## 9. Summary: Phase 1 implementation checklist

1. **UI – Request entry**
   - In **Settings**, add a link/button: “Request to join a club” (or per-club “Request to join this club” when applicable).
2. **UI – Request form**
   - Form: Club (dropdown or fixed), Callsign (default from profile), Optional message. Submit button.
3. **Data**
   - Fetch clubs (existing). For selected club, fetch owner email (e.g. `clubs` join `profiles` on `owner_id`, select `profiles.email`). If no email, show message and do not offer mailto.
4. **Delivery**
   - On submit: build `mailto:owner_email` with subject and body (club name, callsign, message); open in client. Optionally copy body to clipboard as fallback.
5. **Copy**
   - Optional: “No email? Copy request to clipboard” with same text we would put in the email body.

---

## 10. Open points

1. **Exposing owner email:** If we don’t want to expose `profiles.email` to the frontend, implement a small Edge Function that takes `club_id` + request body and either (a) returns a masked/contact email, or (b) sends the email server-side and returns success.
2. **Club managers:** When we add notification to `club_managers`, we can send to owner + all managers (or only to a “primary” contact). Could add `contact_email` on `clubs` as override.
3. **Rate limiting:** If we add `club_join_requests` later, consider rate limits per user or per club to avoid spam.

This design focuses on **getting the request to the manager via email** with minimal backend and a clear path to a stored-request workflow later.
