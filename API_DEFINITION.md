# YMH - REST API Definitions

All endpoints are prefixed with `/api/v1`.
Authentication: Bearer Token (JWT).

## 1. Authentication
### `POST /auth/login`
**Request:**
```json
{
  "email": "user@example.com",
  "password": "secretpassword",
  "device_id": "unique-device-id-123"
}
```
**Response:**
```json
{
  "access_token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

---

## 2. Projects
### `GET /projects`
Fetch all active projects.
**Response:**
```json
[
  {
    "id": "uuid",
    "code": "1853",
    "name": "Istanbul Altyapı",
    "city": "Istanbul",
    "district": "Kadikoy",
    "status": "ACTIVE"
  }
]
```

---

## 3. Photos (Proof System)
### `POST /uploads/presigned` (Optional Optimization)
Or direct upload to server. MVP: Direct upload.

### `POST /photos/upload`
**Content-Type**: `multipart/form-data`
**File**: Image binary
**Body**: `project_id`
**Response:**
```json
{
  "upload_id": "uuid-of-file",
  "s3_key": "projects/1853/date.jpg",
  "hash": "sha256-hash-string"
}
```

### `POST /photos`
Create the metadata record.
**Request:**
```json
{
  "project_id": "uuid",
  "upload_id": "uuid",
  "category": "KANAL_ICI",
  "gps_lat": 41.0082,
  "gps_lng": 28.9784,
  "gps_accuracy": 5.2,
  "device_timestamp": "2023-10-27T10:00:00Z",
  "is_offline_capture": true,
  "voice_note_text": "Borular döşendi."
}
```
**Response:**
```json
{
  "id": "uuid",
  "server_timestamp": "2023-10-27T10:05:00Z", -- Authoritative
  "status": "VERIFIED"
}
```

---

## 4. Materials & Waybills
### `POST /materials/ocr`
Process a waybill image to extract data.
**Request (Multipart):**
*   `file`: Image content
*   `project_id`: uuid
**Response:**
```json
{
  "raw_text": "IRSALIYE NO: 123...",
  "extracted": {
    "date": "2023-10-27",
    "plate": "34ABC123",
    "material_type": "KUM",
    "quantity": 15.5,
    "unit": "TON"
  }
}
```

### `POST /materials`
Submit confirmed material entry.
**Request:**
```json
{
  "project_id": "uuid",
  "material_type": "KUM",
  "quantity": 15.5,
  "unit": "TON",
  "vehicle_plate": "34ABC123",
  "waybill_photo_id": "uuid" (optional)
}
```

---

## 5. Reporting
### `GET /reports/project/:id`
Generate and download the project PDF.
**Response:** Binary PDF stream.
