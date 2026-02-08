# SAHA’M - UX Flow (One Day in the Field)

## "Zero-UI" Philosophy
The application acts as an intelligent shutter. The user's only job is to point and shoot. All context is derived from sensors and history.

---

## 07:45 - Arrival at Site (Auto-Discovery)
**User Action**: Arrives at the construction site. Opens SAHA’M.
**System Action**:
1.  **GPS Lock**: Acquires 3m accuracy.
2.  **Spatial Query**: Checks internal database for active projects within 500m.
3.  **Context Resolution**: Detects "Project 1853 - Kadıköy Main Line".
4.  **UI State**: Application opens directly to **Camera Mode**.
    *   Top Banner (Green): `📍 1853 - KADIKÖY (Active)`
    *   No taps required.

## 08:00 - Material Delivery (Waybill)
**User Action**: Truck arrives with sand. User takes a photo of the **Waybill** held against the truck.
**System Action**:
1.  **Capture**: Photo taken.
2.  **OCR trigger**: Backend accepts upload. Recognizes "IRSALIYE" keyword and tabular data.
3.  **Extraction**:
    *   Material: "KUM (Ince)"
    *   Quantity: "18 TON"
    *   Plate: "34 VR 123"
4.  **Record Creation**: System creates a `MaterialEntry` automatically.
5.  **Feedback**: User receives a subtle vibration. No blocking dialogs.

## 09:30 - Excavation (Sequence Linking)
**User Action**: User takes a photo of the trench (Before).
**System Action**:
1.  **Category Inference**: System creates `FieldPhoto`. Category defaults to `KANAL_ACILISI` based on start of day logic.
2.  **Sequence ID**: New Sequence Group initiated (UUID-A).

**User Action**: 20 minutes later, pipes are laid. User takes another photo (During).
**System Action**:
1.  **Context**: Same GPS radius (<10m). Time difference < 1 hour.
2.  **Linking**: System automatically links this photo to Sequence Group (UUID-A).
3.  **Category**: Infers `KANAL_ICI` (Pipes visible/Time progression).

## 16:00 - End of Day (Offline/Sync)
**User Action**: User drives through a tunnel/remote area (No Signal). Takes closing photos.
**System Action**:
1.  **Offline Queue**: Photos stored in SQLite. `sync_queue` size = 5.
2.  **UI**: Small amber dot indicator.
3.  **Recovery**: User enters city limits (4G). App background process wakelock activates.
4.  **Sync**: 5 Photos uploaded, hashed, and burned with server time.

## 18:00 - Daily Report (One Tap)
**User Action**: Supervisor taps "Report" icon.
**System Action**:
1.  **Aggregation**: Backend compiles all photos (linked by sequence) and material entries.
2.  **PDF Generation**: Generates "1853_DAILY_REPORT_20241027.pdf".
3.  **Delivery**: Links sent to WhatsApp/Email defined in project.

---

**Summary of User Taps**:
*   Open App: 1
*   Capture Photos: ~50
*   Capture Waybills: ~3
*   Generate Report: 1
*   **Total Configuration/Typing**: 0
