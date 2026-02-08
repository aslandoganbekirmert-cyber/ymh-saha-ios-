# YMH - System Architecture & Database Schema

## 1. System Architecture Overview

### High-Level Components
*   **Mobile Client (Edge)**: React Native (Expo) app acting as the primary data ingestion point. It operates on an "Offline-First" principle. All data is written to a local SQLite database first, then synchronized to the server via a `SyncQueue`.
*   **API Server (Core)**: NestJS application serving as the source of truth. It handles authentication, data validation, photo hashing verification, and report generation.
*   **Database**: PostgreSQL for relational data (Projects, Materials, Photo Metadata).
*   **Object Storage**: S3-compatible storage (AWS S3 / MinIO/ R2) for immutable photo assets and generated PDF reports.
*   **OCR Service**: Asynchronous service (AWS Textract / Google Vision) triggered via API for waybill processing.

### Data Flow & Trust CA
1.  **Time**: The server `timestamp` is the only authoritative time for legal proofs. Device time is recorded but flagged if it deviates significantly.
2.  **Location**: GPS coordinates are locked at the moment of capture.
3.  **Integrity**:
    *   Image captured -> Buffer -> SHA-256 Hash -> Upload.
    *   Server verifies Hash on receipt to ensure no tampering during transmission.

### Offline Sync Strategy
*   **Action Queue**: All create/update actions are stored in a local `ActionQueue` table.
*   **Background Sync**: A background worker attempts to flush the queue when internet is available.
*   **Idempotency**: All records use UUIDs generated on the client to prevent duplication during retry storms.

---

## 2. Database Schema (PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS
-- Simple auth, single role for MVP
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROJECTS
-- The core container for all data
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g. "1853"
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. APP_UPLOADS (Photos/Files)
-- Centralized file registry
CREATE TABLE app_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id),
    s3_key VARCHAR(512) NOT NULL,
    bucket VARCHAR(100) NOT NULL,
    mime_type VARCHAR(50),
    file_size_bytes BIGINT,
    sha256_hash VARCHAR(64) NOT NULL, -- Proof of integrity
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. FIELD_PHOTOS
-- Specific metadata for field proofs
CREATE TABLE field_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) NOT NULL,
    upload_id UUID REFERENCES app_uploads(id) NOT NULL,
    
    -- Categorization
    category VARCHAR(50) NOT NULL, -- 'KANAL_ICI', 'KANAL_DISI', 'KAPANIS'
    
    -- Location & Time Proofs
    gps_lat DECIMAL(10, 8) NOT NULL,
    gps_lng DECIMAL(11, 8) NOT NULL,
    gps_accuracy DECIMAL(10, 2),
    
    device_timestamp TIMESTAMPTZ NOT NULL,
    server_timestamp TIMESTAMPTZ DEFAULT NOW(), -- AUTHORITATIVE
    
    is_offline_capture BOOLEAN DEFAULT FALSE,
    time_diff_seconds INTEGER DEFAULT 0, -- Difference between device and verified server time
    
    -- Optional Context
    voice_note_text TEXT,
    sequence_group_id UUID, -- For linking Before/After photos
    
    created_by UUID REFERENCES users(id)
);

-- 5. MATERIAL_ENTRIES
-- Pre-accounting data
CREATE TABLE material_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) NOT NULL,
    
    material_type VARCHAR(50) NOT NULL, -- 'KUM', 'MIL', 'KABLO', etc.
    quantity DECIMAL(12, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'TON', 'M3', 'METRE'
    vehicle_plate VARCHAR(20),
    
    waybill_photo_id UUID REFERENCES app_uploads(id), -- Optional linked photo
    
    -- OCR Data (if scanned)
    ocr_data_json JSONB, -- Stores raw OCR result and confidence
    is_ocr_verified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Indexes for frequent queries
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_field_photos_project ON field_photos(project_id);
CREATE INDEX idx_field_photos_created ON field_photos(created_at);
CREATE INDEX idx_material_entries_project ON material_entries(project_id);
```
