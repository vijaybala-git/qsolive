# QSOlive User Guide

*(Draft – we will iterate)*

This guide explains how to use QSOlive: the interface, how clubs work, and how to get your contacts onto the map.

---

## 1. UI and menu · How clubs work

### Main menu

- **MAP DISPLAY** – The live map of QSOs. Use filters (time, band, mode) and click markers for details.
- **UPLOAD ADIF** – Upload an ADIF file to add past contacts to the map (see section 2a).
- **SETTINGS** – Set your callsign and choose what to monitor: your personal log, one club, or multiple clubs. You can also request to join a club here.
- **CLUB ADMIN** – *(Sign in required)* Create clubs, manage club roster (add/remove callsigns). Club owners and master admins can manage rosters.
- **Help** – **About** (this app’s version and links) and **User Guide** (this document).

### How clubs work

- **Clubs** have a short **name** (e.g. callsign or abbreviation) and a **description** (full name). Each club has a **roster**: a list of operator callsigns. Only contacts from operators on a club’s roster appear when you choose that club in Settings.
- **Your callsign** is set in Settings. The map can show:
  - **My Personal Log** – only your contacts.
  - **One Club** – contacts from operators in one club’s roster.
  - **Multiple Clubs** – contacts from up to 4 clubs.
  - **Public Club** – all contacts (no club filter).
- **To join a club:** Use **Settings → Request to join a club**. You pick a club and send a request (e.g. by email) to the club manager; they add your callsign to the roster in Club Admin.
- **My Clubs** in Settings lists clubs you’re part of (clubs where your callsign is on the roster).

---

## 2. How to get your contacts on the map

Your contacts can appear in two ways: **upload an ADIF file** (batch) or **live stream** from your logging software (real time).

---

### 2a. Upload ADIF

Use **UPLOAD ADIF** in the menu to import contacts from an ADIF file.

**Requirements**

- You must be **signed in**. Your profile **callsign** is used as the operator for uploaded contacts.
- **Location:** Each QSO needs a location for the map. The uploader uses (in order):
   - **GRIDSQUARE** (Maidenhead) in the ADIF, or
   - **MY_GRIDSQUARE** for your position, or
   - A default if missing (contacts without a valid grid may not plot correctly).
- **Recommended ADIF fields:** At minimum: `CALL`, `QSO_DATE`, `TIME_ON`, `BAND`, `MODE`. For best results include `GRIDSQUARE` (or `MY_GRIDSQUARE`) and `STATION_CALLSIGN` if different from your profile callsign.

**Example ADIF snippet**

```adif
<CALL:5>W1ABC <QSO_DATE:8>20250115 <TIME_ON:6>143000 <BAND:3>20m <MODE:3>FT8 <GRIDSQUARE:6>FN31pr <STATION_CALLSIGN:6>W6VIJ <EOR>
```

After upload, contacts appear on the map according to your Settings (e.g. “My Personal Log” or the selected club). Use the time filter to include the date range of the upload.

---

### 2b. Live stream (client software)

To see contacts **live** as you log them, run the QSOlive client on the same machine (or network) as your logging software. The client listens for **UDP ADIF** and sends each QSO to the map.

**Option 1: Python script (development)**

1. Install Python 3.9+ and dependencies (see [client setup](https://github.com/vijaybala-git/qsolive/blob/main/docs/client-setup.md)).
2. Configure `config.json` with your callsign (and Supabase URL/key if not using a prebuilt installer).
3. Run: `python qsolive_client.py`.
4. In your logging software, enable **UDP ADIF** output to port **2237**.

**Option 2: Windows Installer (recommended for most users)**

1. Download the Windows installer from the [QSOlive GitHub Releases](https://github.com/vijaybala-git/qsolive/releases) page (when available). Alternatively, see the [repository](https://github.com/vijaybala-git/qsolive) for build instructions.
2. Run the installer and enter your **callsign** when prompted.
3. Follow the **Configure your logger** steps (e.g. open **NextSteps.txt** from the Start Menu): set your logger to send **UDP ADIF** on port **2237**.
4. Start **QSOlive Client** from the Start Menu. Contacts will appear on the map as you log.

**Logger settings (typical)**

- **Output:** UDP ADIF
- **Port:** 2237
- **Host:** 127.0.0.1 (local) or the IP of the machine running the client

Supported loggers include N1MM Logger+, Win-Test, Logger32, DXLog, and others that support UDP ADIF.

---

*This is a draft. Suggestions and corrections: [file an issue on GitHub](https://github.com/vijaybala-git/qsolive/issues).*
