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
4. In your logging software, enable **UDP ADIF** output to port **2337**.

**Option 2: Windows Installer (recommended for most users)**

1. Download the Windows installer from the [QSOlive GitHub Releases](https://github.com/vijaybala-git/qsolive/releases) page (when available). Alternatively, see the [repository](https://github.com/vijaybala-git/qsolive) for build instructions.
2. Run the installer and enter your **callsign** when prompted.
3. Follow the **Configure your logger** steps (e.g. open **NextSteps.txt** from the Start Menu): set your logger to send **UDP ADIF** on port **2337**.
4. Start **QSOlive Client** from the Start Menu. Contacts will appear on the map as you log.

**Logger settings (typical)**

- **Output:** UDP ADIF
- **Port:** 2337
- **Host:** 127.0.0.1 (local) or the IP of the machine running the client

Supported loggers include N1MM Logger+, Win-Test, Logger32, DXLog, LOG4OM, WriteLog, Ham Radio Deluxe, and others that support UDP ADIF. See section 3 for step-by-step configuration of popular loggers.

---

## 3. Configuring your logger for QSOlive

Start **QSOlive Client** before or after starting your logger. The client listens for UDP ADIF on **127.0.0.1:2337**. Configure your logging program to send QSOs to that address and port in **ADIF** format. New QSOs will then appear on the QSOlive map as you log.

---

### N1MM Logger+

1. Go to **Config → Configure Ports, Mode Control → Broadcast Data**.
2. Check **Contact**, set **IP** to **127.0.0.1**, **Port** to **2337**, **Format** to **ADIF**.
3. Click **OK**. Enter and save a QSO; it will appear on the QSOlive map.

---

### DXLog

1. Start **DXLog**.
2. Click **Options → Configure Network → QSO UDP broadcast**. Set **IP address** to **127.0.0.1** and **Port** to **2337**. Click **OK**.
3. Click **Options → Broadcast → QSOs**.
4. Click **Options → Broadcast → Use N1MM QSO Format** (or ensure ADIF-style output is enabled).
5. Enter and save a QSO; it will appear on the QSOlive map.

See also: [DXLog UDP broadcast documentation](http://dxlog.net/docs/index.php/Additional_Information#UDP_broadcast).

---

### Ham Radio Deluxe

1. Start **Ham Radio Deluxe**.
2. Click **Logbook → Configure → QSO Forwarding** (see [Ham Radio Deluxe QSO Forwarding](https://support.hamradiodeluxe.com/support/solutions/articles/51000052684-qso-forwarding)).
3. Check **Forward logbook changes using UDP to other logging programs**.
4. Set **Send Address** to **127.0.0.1** and **Send Port** to **2337**. Leave **UDP Receive** options unchecked. Click **OK**.
5. Start **QSOlive Client**. New QSOs will appear on the QSOlive map.

---

### LOG4OM

1. Start **LOG4OM** (with your log database ready).
2. Go to **Settings → Program Configuration → Software integration → Connections → UDP**.
3. In **UDP OUTBOUND**, set **Port** to **2337**, **Connection name** to **QSOlive**, **Service type** to **ADIF MESSAGE**.
4. Leave **Broadcast** unchecked. Set **Destination IP Address** to **127.0.0.1**.
5. Click the green **+** so the connection appears in **UDP Outbound connections**.
6. Click **Save and apply** (top left).
7. Start **QSOlive Client**. Enter and save a QSO in LOG4OM; it will appear on the QSOlive map.

---

### WriteLog

1. Start **WriteLog** and select your contest or log type.
2. Go to **Setup → WriteLog Options → UDP Broadcast**.
3. Check **Enable** for **QSOs**. Set **Address** to **localhost** and **Port number** to **2337**.
4. Click **OK**, then **Setup → Save Configuration**.
5. Start **QSOlive Client**. Enter and save a QSO; it will appear on the QSOlive map.

---

### Win-Test

1. Go to **Options → Interfaces**.
2. Add a **UDP** interface: **Host** = **localhost**, **Port** = **2337**, **Format** = **ADIF**.
3. Enable it and save. Start **QSOlive Client**; new QSOs will appear on the map.

---

### Logger32

1. Go to **Setup → Options → UDP**.
2. Enable UDP, set **Port** to **2337**, **Format** to **ADIF**.
3. Save and start **QSOlive Client**; new QSOs will appear on the map.

---

### Troubleshooting

- **No contacts on the map:** Ensure QSOlive Client is running, your logger is sending to **127.0.0.1:2337**, and the format is **ADIF**. Check that your **callsign** in QSOlive (installer or config) matches the operator in your log.
- **Port in use:** Only one program can listen on port 2337. Close any other instance of QSOlive Client or another UDP listener using that port.
- **Log file:** When using the Windows installer, the client writes a log file to **%LOCALAPPDATA%\QSOlive\qsolive_client.log** (see NextSteps.txt). Use it to confirm that UDP packets are being received.

---

*This is a draft. Suggestions and corrections: [file an issue on GitHub](https://github.com/vijaybala-git/qsolive/issues).*
