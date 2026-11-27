# ScanKaro — Project Architecture

## 1. Project Overview

**ScanKaro** is a mobile document scanning application that enables users to capture, organize, and digitize physical documents using their smartphone camera. The app provides intelligent document detection, OCR (Optical Character Recognition) for text extraction, and cloud-based storage with folder organization.

### Purpose
- Transform physical documents into digital scans with automatic edge detection and perspective correction
- Extract text from scanned documents using OCR technology
- Organize scans into customizable folders
- Enable search across scanned document content
- Provide secure cloud backup and multi-device sync

### Goals
- Deliver a seamless, camera-first document scanning experience
- Achieve high OCR accuracy for multiple languages
- Enable offline-first functionality with background sync
- Support freemium monetization model (free/pro tiers)
- Maintain enterprise-grade security and privacy

### Target Users
- Students and academics digitizing notes and research materials
- Professionals managing business documents and receipts
- Individuals organizing personal records and archives
- Teams collaborating on shared document collections

---

## 2. Tech Stack

### Frontend (Mobile App)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | React Native | 0.81.5 | Cross-platform mobile development |
| **Platform** | Expo | ~54.0.0 | Development toolchain and runtime |
| **Language** | TypeScript | ~5.9.2 | Type-safe development |
| **Navigation** | Expo Router | ~6.0.24 | File-based routing |
| **Styling** | NativeWind + Tailwind CSS | v4.2.6 / ^3.4.19 | Utility-first styling |
| **State Management** | React Context | Built-in | Global state (auth, scan session) |
| **Camera** | Expo Camera | ~17.0.10 | Document capture |
| **Image Processing** | Expo Image Manipulator | ~14.0.8 | Image cropping and transformation |
| **Authentication** | Firebase Auth | ^12.15.0 | Google Sign-In and user management |
| **Storage** | AsyncStorage | 2.2.0 | Local persistence |
| **Animations** | Reanimated | ~4.1.1 | Smooth UI transitions |
| **Gestures** | Gesture Handler | ~2.28.0 | Touch interactions |
| **Icons** | Expo Vector Icons | ^15.1.1 | Iconography |
| **Fonts** | Google Fonts (Inter) | ^0.4.2 | Typography |

### Backend (API Server)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Runtime** | Node.js | >=20 | Server runtime |
| **Framework** | Express | ^4.21.2 | REST API framework |
| **Language** | JavaScript (ESM) | - | Server-side logic |
| **Database** | MongoDB | ^8.13.2 (Mongoose) | Primary data store |
| **Cache/Queue** | Redis | ^5.11.1 (ioredis) | Rate limiting, OCR job queue |
| **Job Queue** | Bull | ^4.16.5 | Background OCR processing |
| **OCR Engine** | Tesseract.js | ^7.0.0 | Text extraction from images |
| **Authentication** | Firebase Admin | ^13.2.0 | Token verification |
| **File Storage** | Cloudinary | ^2.6.0 | Image hosting and CDN |
| **Validation** | Zod | ^3.24.2 | Schema validation |
| **Security** | Helmet, CORS, Rate Limiting | Various | API protection |
| **Logging** | Winston | ^3.19.0 | Structured logging |
| **File Upload** | Multer | ^2.2.0 | Multipart form handling |

### External Services

| Service | Purpose |
|---------|---------|
| **Firebase** | Authentication (Google Sign-In), user management |
| **Cloudinary** | Image storage, optimization, and CDN delivery |
| **MongoDB** | Persistent storage for users, folders, documents |
| **Redis** | Rate limiting, response caching, OCR job queue |

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USERS                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              React Native Mobile App (Expo)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Camera     │  │     OCR      │  │   Local Storage  │  │
│  │   Module     │  │   Preview    │  │   (AsyncStorage) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │  API Client    │                       │
│                    │  (Axios/Fetch) │                       │
│                    └───────┬────────┘                       │
└────────────────────────────┼────────────────────────────────┘
                             │
                    HTTPS/REST API
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js Backend API                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware Layer                                    │  │
│  │  • Helmet (Security headers)                         │  │
│  │  • CORS (Cross-origin requests)                      │  │
│  │  • Rate Limiting (Redis-backed)                      │  │
│  │  • Authentication (Firebase token verification)       │  │
│  │  • Validation (Zod schemas)                          │  │
│  │  • Compression                                       │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │  Routes Layer                                        │  │
│  │  • /api/auth      - User authentication              │  │
│  │  • /api/documents - Document CRUD operations         │  │
│  │  • /api/folders   - Folder management                │  │
│  │  • /api/ocr       - OCR processing                   │  │
│  │  • /api/upload    - Image uploads                     │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │  Controllers Layer                                   │  │
│  │  • Handle business logic                             │  │
│  │  • Orchestrate service calls                         │  │
│  │  • Format responses                                   │  │
│  └──────────────────────┬───────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼───────────────────────────────┐  │
│  │  Services Layer                                      │  │
│  │  • UserService      - User operations                │  │
│  │  • DocumentService  - Document management            │  │
│  │  • FolderService    - Folder operations              │  │
│  │  • OcrService       - OCR processing                 │  │
│  │  • CloudinaryService - File uploads                   │  │
│  │  • CacheService     - Redis caching                   │  │
│  └──────────────────────┬───────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
     │   MongoDB    │ │   Redis     │ │  Cloudinary │
     │  (Database)  │ │  (Cache/    │ │  (Storage)  │
     │              │ │   Queue)    │ │             │
     └─────────────┘ └─────────────┘ └─────────────┘
                             │
                             ▼
                  ┌──────────────────┐
                  │  OCR Worker      │
                  │  (Tesseract.js)  │
                  │  Background Job  │
                  └──────────────────┘
```

### Component Interaction Flow

1. **Mobile App** captures images via camera module
2. **Local Processing** applies document detection and perspective correction
3. **API Client** uploads processed images to backend
4. **Backend** validates, stores images on Cloudinary, and queues OCR job
5. **OCR Worker** processes images asynchronously using Tesseract.js
6. **Database** stores metadata (users, folders, documents, OCR text)
7. **Mobile App** syncs with backend to fetch updated documents and OCR results

---

## 4. Folder/File Structure

```
ScanKaro/
├── .env.example                          # Environment variables template
├── .gitignore                            # Git ignore rules
├── AGENTS.md                             # AI agent instructions
├── app.json                              # Expo app configuration
├── babel.config.js                       # Babel transpiler config
├── CLAUDE.md                             # Claude AI instructions
├── docker-compose.yml                    # Docker services (Redis)
├── global.css                            # Global styles
├── index.ts                              # App entry point
├── LICENSE                               # License file
├── metro.config.js                       # Metro bundler config
├── nativewind-env.d.ts                   # NativeWind TypeScript declarations
├── package.json                          # Frontend dependencies
├── package-lock.json                     # Locked dependencies
├── README.md                             # Project documentation
├── tailwind.config.js                    # Tailwind CSS configuration
├── tsconfig.json                         # TypeScript configuration
│
├── android/                              # Android native project
│   ├── .gitignore
│   ├── build.gradle
│   ├── gradle.properties
│   ├── gradlew
│   ├── gradlew.bat
│   ├── settings.gradle
│   ├── app/                              # Android app module
│   └── gradle/                           # Gradle wrapper
│
├── app/                                  # Expo Router screens
│   ├── _layout.tsx                       # Root layout with providers
│   ├── index.tsx                         # Home screen
│   ├── onboarding.tsx                    # Onboarding flow
│   ├── login.tsx                         # Login screen
│   ├── scan.tsx                          # Camera/scan screen
│   ├── crop.tsx                          # Image cropping screen
│   ├── ocr.tsx                           # OCR preview screen
│   ├── export.tsx                        # Export/share screen
│   ├── paywall.tsx                       # Subscription screen
│   ├── security.tsx                      # Security settings
│   ├── account.tsx                       # User account screen
│   ├── (tabs)/                           # Tab navigation screens
│   ├── document/                         # Document detail screens
│   │   └── [id].tsx                      # Dynamic document view
│   └── folder/                           # Folder screens
│       └── [id].tsx                      # Dynamic folder view
│
├── assets/                               # Static assets
│   ├── android-icon-background.png
│   ├── android-icon-foreground.png
│   ├── android-icon-monochrome.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
│
├── backend/                              # Express.js API server
│   ├── .env.example                      # Backend environment template
│   ├── .gitignore
│   ├── eng.traineddata                   # Tesseract English language data
│   ├── package.json                      # Backend dependencies
│   ├── package-lock.json
│   ├── scripts/                          # Utility scripts
│   └── src/                              # Backend source code
│       ├── server.js                     # Entry point, bootstrap
│       ├── app.js                        # Express app configuration
│       ├── ocr-worker.js                 # Standalone OCR worker
│       │
│       ├── config/                       # Configuration files
│       │   ├── cloudinary.js             # Cloudinary setup
│       │   ├── database.js               # MongoDB connection
│       │   ├── env.js                    # Environment variables
│       │   ├── firebase.js               # Firebase Admin setup
│       │   ├── logger.js                 # Winston logger
│       │   └── redis.js                  # Redis connection
│       │
│       ├── controllers/                  # Request handlers
│       │   ├── auth.controller.js        # Authentication endpoints
│       │   ├── document.controller.js    # Document operations
│       │   ├── folder.controller.js      # Folder operations
│       │   ├── health.controller.js      # Health check
│       │   ├── ocr.controller.js         # OCR endpoints
│       │   └── upload.controller.js      # File upload handling
│       │
│       ├── middleware/                   # Express middleware
│       │   ├── auth.middleware.js        # Firebase token verification
│       │   ├── error.middleware.js       # Error handling
│       │   ├── notFound.middleware.js    # 404 handler
│       │   ├── requestLogger.middleware.js # Request logging
│       │   ├── upload.middleware.js      # Multer configuration
│       │   ├── userRateLimit.middleware.js # Rate limiting
│       │   └── validate.middleware.js    # Zod validation
│       │
│       ├── models/                       # Mongoose schemas
│       │   ├── User.model.js             # User schema
│       │   ├── Folder.model.js           # Folder schema
│       │   ├── Document.model.js         # Document schema
│       │   ├── Page.schema.js            # Embedded page schema
│       │   └── (Note: No separate Page.model.js - embedded)
│       │
│       ├── queues/                       # Background job queues
│       │   └── ocr.queue.js              # Bull queue for OCR
│       │
│       ├── routes/                       # API route definitions
│       │   ├── index.js                  # Route aggregator
│       │   ├── auth.routes.js            # /api/auth/*
│       │   ├── document.routes.js        # /api/documents/*
│       │   ├── folder.routes.js          # /api/folders/*
│       │   ├── health.routes.js          # /health
│       │   ├── ocr.routes.js             # /api/ocr/*
│       │   └── upload.routes.js          # /api/upload/*
│       │
│       ├── services/                     # Business logic
│       │   ├── cache.service.js          # Redis caching
│       │   ├── cloudinary.service.js     # Cloudinary operations
│       │   ├── document.service.js       # Document logic
│       │   ├── folder.service.js         # Folder logic
│       │   ├── ocr.service.js            # OCR orchestration
│       │   ├── ocr-image.service.js      # Image OCR processing
│       │   ├── rate-limit.service.js     # Rate limiting logic
│       │   ├── user.service.js           # User operations
│       │   └── ocr/                      # OCR-specific services
│       │
│       ├── utils/                        # Utility functions
│       │   ├── ApiError.js               # Custom error class
│       │   ├── asyncHandler.js           # Async wrapper
│       │   ├── documentFilters.js        # Query filters
│       │   └── userSerializer.js         # User data formatting
│       │
│       └── validators/                   # Zod validation schemas
│           ├── document.validator.js
│           ├── folder.validator.js
│           ├── ocr.validator.js
│           └── upload.validator.js
│
├── components/                           # Reusable React Native components
│   ├── CreateFolderSheet.tsx             # Folder creation modal
│   ├── DocumentListItem.tsx              # Document list item
│   ├── Icon.tsx                          # Icon wrapper component
│   ├── LoadingOverlay.tsx                # Loading spinner
│   ├── ScreenHeader.tsx                  # Screen header component
│   ├── SearchField.tsx                   # Search input
│   ├── SwitchRow.tsx                     # Toggle switch row
│   ├── document/                         # Document-specific components
│   ├── scan/                             # Scan-related components
│   └── settings/                         # Settings components
│
├── constants/                            # App constants
│   ├── config.ts                         # App configuration
│   └── data.ts                           # Static data
│
├── context/                              # React Context providers
│   ├── AppProvider.tsx                   # Global app state
│   └── ScanProvider.tsx                  # Scan session state
│
├── hooks/                                # Custom React hooks
│   ├── useDebouncedValue.ts              # Debounce hook
│   └── useGoogleAuth.ts                  # Google authentication
│
├── services/                             # Frontend services
│   ├── index.ts                          # Service exports
│   ├── interfaces.ts                     # TypeScript interfaces
│   ├── nativeDocumentScanner.ts          # Native scanner wrapper
│   ├── settings.ts                       # App settings service
│   ├── uploadScan.ts                     # Scan upload logic
│   ├── api/                              # API client services
│   ├── firebase/                         # Firebase services
│   └── mock/                             # Mock data for development
│
├── types/                                # TypeScript type definitions
│   └── index.ts                          # Shared types
│
└── utils/                                # Utility functions
    ├── documentDetection.ts              # Document edge detection
    ├── documentFrame.ts                  # Frame extraction
    ├── documentScan.ts                   # Scanning logic
    ├── navigation.ts                     # Navigation helpers
    ├── opencvDocumentScan.ts             # OpenCV scanning
    ├── scanFilters.ts                    # Image filters
    ├── scanPicker.ts                     # Image picker
    └── shareDocument.ts                  # Document sharing
```

---

## 5. Core Modules/Components

### Frontend Modules

#### 1. **Camera & Scanning Module**
- **Location**: `app/scan.tsx`, `utils/documentScan.ts`, `utils/opencvDocumentScan.ts`
- **Responsibility**: Capture images from device camera, apply document detection algorithms, perform perspective correction and edge enhancement
- **Key Features**:
  - Real-time document edge detection
  - Auto-capture when document is properly framed
  - Image filters (grayscale, contrast enhancement)
  - Multi-page scanning support

#### 2. **Authentication Module**
- **Location**: `app/login.tsx`, `hooks/useGoogleAuth.ts`, `services/firebase/`
- **Responsibility**: Handle user authentication via Google Sign-In, manage auth state, sync with backend
- **Key Features**:
  - Google OAuth integration
  - Firebase token management
  - Auto-login on app restart
  - User profile synchronization

#### 3. **Document Management Module**
- **Location**: `app/document/`, `components/document/`, `services/api/`
- **Responsibility**: CRUD operations for scanned documents, metadata management, search functionality
- **Key Features**:
  - Create, read, update, delete documents
  - Favorite and delete (soft delete) operations
  - Full-text search across OCR text
  - Document detail view with pages

#### 4. **Folder Organization Module**
- **Location**: `app/folder/`, `components/CreateFolderSheet.tsx`
- **Responsibility**: Organize documents into folders, manage folder hierarchy
- **Key Features**:
  - Create/edit/delete folders
  - Custom folder colors and icons
  - Document count tracking
  - Drag-and-drop organization (future)

#### 5. **OCR Module**
- **Location**: `app/ocr.tsx`, `services/api/`
- **Responsibility**: Display OCR results, allow text editing, copy to clipboard
- **Key Features**:
  - View extracted text
  - Edit OCR results
  - Copy text to clipboard
  - Share extracted text

#### 6. **Export & Share Module**
- **Location**: `app/export.tsx`, `utils/shareDocument.ts`
- **Responsibility**: Export documents as PDF/images, share via native share sheet
- **Key Features**:
  - PDF generation
  - Image export (JPEG/PNG)
  - Native share integration
  - Multiple page support

#### 7. **Settings & Security Module**
- **Location**: `app/security.tsx`, `app/account.tsx`, `components/settings/`
- **Responsibility**: App configuration, security settings, account management
- **Key Features**:
  - Biometric authentication toggle
  - Passcode protection
  - Account deletion
  - Subscription management

### Backend Modules

#### 1. **Authentication Service**
- **Location**: `backend/src/controllers/auth.controller.js`, `backend/src/middleware/auth.middleware.js`
- **Responsibility**: Verify Firebase tokens, sync user data, manage sessions
- **Key Features**:
  - Firebase ID token verification
  - User profile upsert
  - Protected route middleware

#### 2. **Document Service**
- **Location**: `backend/src/services/document.service.js`, `backend/src/controllers/document.controller.js`
- **Responsibility**: Document CRUD operations, search, OCR text updates
- **Key Features**:
  - Create/update/delete documents
  - Full-text search (MongoDB text index)
  - Soft delete with trash management
  - OCR text updates

#### 3. **Folder Service**
- **Location**: `backend/src/services/folder.service.js`, `backend/src/controllers/folder.controller.js`
- **Responsibility**: Folder CRUD operations, document counting
- **Key Features**:
  - Create/update/delete folders
  - Document count aggregation
  - Folder-document relationships

#### 4. **OCR Service**
- **Location**: `backend/src/services/ocr.service.js`, `backend/src/queues/ocr.queue.js`
- **Responsibility**: Queue and process OCR jobs, extract text from images
- **Key Features**:
  - Bull queue for async processing
  - Tesseract.js integration
  - Multi-language support
  - OCR result caching

#### 5. **Upload Service**
- **Location**: `backend/src/services/cloudinary.service.js`, `backend/src/controllers/upload.controller.js`
- **Responsibility**: Handle file uploads, store on Cloudinary, generate URLs
- **Key Features**:
  - Multipart form handling (Multer)
  - Cloudinary upload with optimization
  - Image transformation
  - CDN URL generation

#### 6. **Rate Limiting Service**
- **Location**: `backend/src/middleware/userRateLimit.middleware.js`, `backend/src/services/rate-limit.service.js`
- **Responsibility**: Protect API from abuse, enforce usage limits
- **Key Features**:
  - Per-user rate limiting (Redis-backed)
  - IP-based fallback limiting
  - Configurable limits and windows
  - Upload-specific limits

#### 7. **Caching Service**
- **Location**: `backend/src/services/cache.service.js`
- **Responsibility**: Cache frequently accessed data, reduce database load
- **Key Features**:
  - Folder list caching
  - User profile caching
  - TTL-based expiration
  - Cache invalidation on updates

---

## 6. Data Flow

### Document Scanning Flow

```
1. User opens app → Navigate to Scan screen
2. Camera module activates → Real-time preview with document detection
3. User captures image → Image saved to local storage
4. Document detection applied → Perspective correction, edge enhancement
5. User confirms scan → Image processed locally
6. User saves document → 
   a. Image uploaded to Cloudinary
   b. Document metadata sent to API
   c. API creates document record in MongoDB
   d. OCR job queued in Redis/Bull
7. Background OCR processing →
   a. Worker picks up job from queue
   b. Tesseract.js extracts text from image
   c. OCR text updated in MongoDB
8. Mobile app syncs → Fetches updated document with OCR text
9. User views document → OCR text displayed, editable
```

### Authentication Flow

```
1. User taps "Sign In with Google"
2. Firebase Auth opens → User authenticates with Google
3. Firebase returns ID token → Sent to backend /api/auth/sync
4. Backend verifies token → Firebase Admin SDK validation
5. Backend upserts user → Creates/updates user in MongoDB
6. Backend returns user profile → Includes plan, storage usage
7. Mobile app stores user data → AsyncStorage persistence
8. Subsequent requests → Include Firebase token in Authorization header
9. Backend middleware verifies token → Every protected request
```

### Folder & Document Organization Flow

```
1. User creates folder → POST /api/folders
   a. Backend validates request (Zod)
   b. Creates folder in MongoDB
   c. Returns folder object
2. User scans document → Saves to folder
   a. Upload image to Cloudinary
   b. POST /api/documents with folderId
   c. Backend creates document with folder reference
   d. Increments folder.docCount
3. User moves document → PATCH /api/documents/:id
   a. Update folderId
   b. Decrement old folder.docCount
   c. Increment new folder.docCount
4. User deletes folder → DELETE /api/folders/:id
   a. Set folderId to null on all documents
   b. Delete folder record
```

### OCR Processing Flow

```
1. Document uploaded → POST /api/upload or /api/documents
2. Backend stores image → Cloudinary upload
3. OCR job queued → Bull queue with image URL
4. Worker processes job →
   a. Downloads image from Cloudinary
   b. Runs Tesseract.js OCR
   c. Extracts text and confidence scores
5. OCR result stored → PATCH /api/documents/:id/ocr
   a. Updates ocrText field
   b. Sets ocrUpdatedAt timestamp
6. Mobile app syncs → Fetches updated document
7. User views OCR text → Displayed in OCR screen
```

---

## 7. APIs/Endpoints

### Authentication Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| GET | `/api/auth/me` | Get current user profile | - | `{ success, data: User }` |
| POST | `/api/auth/sync` | Sync user after Firebase login | `{ firebaseToken }` | `{ success, message, data: User }` |

**Headers**: `Authorization: Bearer <firebase_id_token>`

### Document Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| GET | `/api/documents` | List user documents | Query: `page`, `limit`, `folderId`, `favorite`, `sort` | `{ success, data: [Document], total }` |
| GET | `/api/documents/:id` | Get single document | - | `{ success, data: Document }` |
| PATCH | `/api/documents/:id` | Update document | `{ title, folderId, isFavorite }` | `{ success, data: Document }` |
| PATCH | `/api/documents/:id/ocr` | Update OCR text | `{ ocrText }` | `{ success, data: Document }` |
| DELETE | `/api/documents/:id` | Delete document (soft) | - | `{ success, message }` |
| GET | `/api/documents/search` | Search documents | Query: `q`, `page`, `limit` | `{ success, data: [Document], total }` |

**Headers**: `Authorization: Bearer <firebase_id_token>`

### Folder Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| GET | `/api/folders` | List user folders | Query: `page`, `limit` | `{ success, data: [Folder], total }` |
| POST | `/api/folders` | Create folder | `{ name, color, icon }` | `{ success, data: Folder }` |
| PATCH | `/api/folders/:id` | Update folder | `{ name, color, icon }` | `{ success, data: Folder }` |
| DELETE | `/api/folders/:id` | Delete folder | - | `{ success, message }` |
| GET | `/api/folders/:id/documents` | Get folder documents | Query: `page`, `limit` | `{ success, data: [Document], total }` |

**Headers**: `Authorization: Bearer <firebase_id_token>`

### OCR Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/api/ocr` | Trigger OCR processing | `{ imageUrl, documentId }` | `{ success, data: { jobId } }` |
| GET | `/api/ocr/status/:jobId` | Check OCR job status | - | `{ success, data: { status, result } }` |

**Headers**: `Authorization: Bearer <firebase_id_token>`

### Upload Endpoints

| Method | Endpoint | Purpose | Request Body | Response |
|--------|----------|---------|--------------|----------|
| POST | `/api/upload` | Upload image(s) | Multipart: `images[]` | `{ success, data: [{ url, publicId }] }` |

**Headers**: `Authorization: Bearer <firebase_id_token>`

### Health Endpoint

| Method | Endpoint | Purpose | Response |
|--------|----------|---------|----------|
| GET | `/health` | API health check | `{ status, timestamp, uptime }` |

---

## 8. Database Schema

### MongoDB Collections

#### Users Collection

```javascript
{
  _id: ObjectId,
  firebaseUid: String,          // Unique Firebase UID
  email: String,                // User email (lowercase, indexed)
  displayName: String,          // Display name (default: "ScanKaro User")
  photoURL: String,             // Profile photo URL
  plan: String,                 // 'free' | 'pro' (default: 'free')
  storageUsed: Number,          // Bytes used (default: 0)
  lastLoginAt: Date,            // Last login timestamp
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - { firebaseUid: 1 } (unique)
// - { email: 1 } (unique)
// - { email: 1, firebaseUid: 1 } (compound)
```

#### Folders Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,             // Reference to User
  name: String,                 // Folder name (max: 100 chars)
  color: String,                // UI color class (default: 'bg-primary-container')
  icon: String,                 // Icon name (default: 'folder')
  docCount: Number,             // Document count (default: 0)
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - { userId: 1, name: 1 } (unique per user)
// - { userId: 1, createdAt: -1 }
// - userId: 1 (foreign key)
```

#### Documents Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,             // Reference to User
  firebaseUid: String,          // Firebase UID (indexed)
  folderId: ObjectId | null,    // Reference to Folder (nullable)
  title: String,                // Document title (default: 'Untitled Scan')
  ocrText: String,              // Extracted OCR text (default: '')
  ocrUpdatedAt: Date | null,    // Last OCR update timestamp
  isFavorite: Boolean,          // Favorite flag (default: false)
  isDeleted: Boolean,           // Soft delete flag (default: false)
  deletedAt: Date | null,       // Deletion timestamp
  pages: [Page],                // Array of page objects
  pageCount: Number,            // Total pages (default: 0)
  totalFileSize: Number,        // Total file size in bytes (default: 0)
  createdAt: Date,
  updatedAt: Date
}

// Indexes:
// - { userId: 1, createdAt: -1 }
// - { userId: 1, folderId: 1, createdAt: -1 }
// - { userId: 1, isFavorite: 1, createdAt: -1 }
// - { userId: 1, isDeleted: 1, createdAt: -1 }
// - { title: 'text', ocrText: 'text' } (full-text search)
// - userId: 1 (foreign key)
// - folderId: 1 (foreign key)
```

#### Embedded Page Schema (within Documents)

```javascript
{
  pageNumber: Number,           // Page number (min: 1)
  order: Number,                // Display order (min: 0)
  cloudinaryPublicId: String,   // Cloudinary asset ID
  cloudinaryUrl: String,        // Cloudinary CDN URL
  width: Number,                // Image width in pixels
  height: Number,               // Image height in pixels
  fileSize: Number              // File size in bytes (min: 0)
}

// Note: No separate _id field (_id: false in schema)
```

### Entity Relationships

```
User (1) ──────< (N) Folder
  │
  └──────< (N) Document

Folder (1) ──────< (N) Document

Document (1) ──────< (N) Page (embedded)
```

**Relationship Details**:
- One user can have multiple folders
- One user can have multiple documents
- One folder can contain multiple documents
- One document can have multiple pages (embedded array)
- Documents can exist without folders (folderId: null)
- Deleting a user cascades to folders and documents (application-level)

---

## 9. Environment & Setup

### Prerequisites

- **Node.js** >= 20.x
- **npm** or **yarn**
- **MongoDB** >= 6.x (local or Atlas)
- **Redis** >= 7.x (for rate limiting and OCR queue)
- **Firebase** project with Authentication enabled
- **Cloudinary** account
- **Expo CLI** (`npm install -g expo-cli`)
- **iOS Simulator** (Mac only) or **Android Emulator**

### Frontend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/s-a-b-i/ScanKaro.git
   cd ScanKaro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy example env file (if exists)
   cp .env.example .env
   
   # Edit .env with your Firebase config
   # FIREBASE_API_KEY=your_api_key
   # FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   # etc.
   ```

4. **Configure Firebase**
   - Create Firebase project at https://console.firebase.google.com
   - Enable Google Sign-In authentication
   - Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   - Place in respective platform folders

5. **Start development server**
   ```bash
   npm start
   ```

6. **Run on device/simulator**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   
   # Web (for testing)
   npm run web
   ```

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   
   # MongoDB
   MONGODB_URI=mongodb://127.0.0.1:27017/scankaro
   
   # Firebase Admin
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   
   # Cloudinary
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   CLOUDINARY_UPLOAD_FOLDER=scankaro
   
   # CORS
   CORS_ORIGIN=http://localhost:8081
   
   # Rate Limiting
   API_RATE_LIMIT_MAX=200
   API_RATE_LIMIT_WINDOW_MS=900000
   
   # Redis
   REDIS_URL=redis://127.0.0.1:6379
   OCR_PROVIDER=tesseract
   OCR_QUEUE_CONCURRENCY=2
   ```

4. **Start Redis** (using Docker)
   ```bash
   docker compose up -d redis
   ```

5. **Start development server**
   ```bash
   # Start API server
   npm run dev
   
   # In separate terminal, start OCR worker (production)
   npm run worker:ocr
   ```

6. **Verify installation**
   ```bash
   curl http://localhost:3000/health
   # Expected: { "status": "ok", ... }
   ```

### Database Setup

1. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or using local installation
   mongod
   ```

2. **Database is auto-initialized**
   - MongoDB connection established on server start
   - Mongoose handles schema creation automatically
   - No manual migration needed

### Firebase Setup

1. **Create Firebase project**
   - Go to https://console.firebase.google.com
   - Create new project
   - Enable Google Sign-In in Authentication

2. **Generate service account key**
   - Project Settings → Service Accounts
   - Generate new private key
   - Download JSON file
   - Copy `client_email` and `private_key` to `.env`

3. **Configure Firebase in mobile app**
   - Add Firebase to your app (iOS/Android)
   - Download config files
   - Place in platform directories

---

## 10. Deployment

### Frontend Deployment

#### Expo Application Services (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to App Store
eas submit --platform ios

# Submit to Google Play
eas submit --platform android
```

#### Environment Configuration

- **Development**: `expo start`
- **Staging**: EAS Build with `--profile staging`
- **Production**: EAS Build with `--profile production`

### Backend Deployment

#### Option 1: Docker Deployment

```dockerfile
# Dockerfile (example)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/server.js"]
```

```bash
# Build image
docker build -t scankaro-api .

# Run container
docker run -d \
  --name scankaro-api \
  -p 3000:3000 \
  --env-file .env \
  scankaro-api
```

#### Option 2: Cloud Platform (Recommended)

**AWS / GCP / Azure**:
- Deploy to EC2 / Compute Engine / VM
- Use PM2 for process management:
  ```bash
  npm install -g pm2
  pm2 start src/server.js --name scankaro-api
  pm2 save
  pm2 startup
  ```

**Heroku / Render / Railway**:
- Connect GitHub repository
- Configure environment variables
- Deploy automatically on push

**Vercel / Netlify** (for serverless):
- Requires adaptation to serverless functions
- Not recommended for OCR worker (needs long-running process)

### Database Deployment

#### MongoDB Atlas (Recommended)

1. Create cluster at https://cloud.mongodb.com
2. Configure network access (IP whitelist)
3. Create database user
4. Update `MONGODB_URI` in `.env`:
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/scankaro
   ```

#### Self-Hosted MongoDB

```bash
# Using Docker
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:latest
```

### Redis Deployment

#### Redis Cloud (Recommended)

1. Create account at https://redis.com/cloud
2. Create database
3. Update `REDIS_URL` in `.env`

#### Self-Hosted Redis

```bash
# Using Docker
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:alpine
```

### Cloudinary Setup

1. Create account at https://cloudinary.com
2. Get cloud name, API key, API secret
3. Configure upload preset (optional)
4. Update environment variables

### Production Checklist

- [ ] Enable HTTPS (SSL/TLS certificates)
- [ ] Configure CORS for production domains
- [ ] Set up rate limiting with appropriate limits
- [ ] Enable MongoDB authentication
- [ ] Configure Redis authentication
- [ ] Set up logging and monitoring (Winston + external service)
- [ ] Configure backup strategy for MongoDB
- [ ] Set up health check monitoring
- [ ] Enable Cloudinary optimizations
- [ ] Configure Firebase production project
- [ ] Set up error tracking (Sentry, Bugsnag)
- [ ] Configure CI/CD pipeline
- [ ] Set up staging environment
- [ ] Enable API versioning
- [ ] Configure firewall rules
- [ ] Set up DDoS protection

### Monitoring & Maintenance

- **API Monitoring**: UptimeRobot, Pingdom, or CloudWatch
- **Error Tracking**: Sentry, Bugsnag, or Rollbar
- **Log Management**: Winston + Papertrail, Loggly, or CloudWatch Logs
- **Performance**: MongoDB Atlas Metrics, Redis Insights
- **Analytics**: Firebase Analytics, Mixpanel, or Amplitude

---

## Additional Notes

### Architecture Decisions

1. **Why Expo?**
   - Rapid development and iteration
   - Over-the-air updates
   - Built-in camera, image manipulation APIs
   - Easy iOS/Android deployment

2. **Why MongoDB?**
   - Flexible schema for document metadata
   - Native JSON support
   - Powerful text search capabilities
   - Horizontal scalability

3. **Why Redis?**
   - Fast in-memory caching
   - Reliable job queue (Bull)
   - Rate limiting with atomic operations
   - Session storage

4. **Why Cloudinary?**
   - Automatic image optimization
   - CDN delivery
   - Transformations (resize, crop, format)
   - Built-in security

5. **Why Tesseract.js?**
   - Client-side and server-side OCR
   - Multi-language support
   - No external API dependencies
   - Cost-effective

### Performance Considerations

- **Image Compression**: Compress images before upload (reduce bandwidth)
- **Lazy Loading**: Load documents on-demand in lists
- **Pagination**: All list endpoints support pagination
- **Caching**: Cache folders, user profiles, and frequent queries
- **CDN**: Cloudinary CDN for fast image delivery
- **Database Indexes**: Optimized indexes for common queries
- **Rate Limiting**: Prevent abuse and ensure fair usage

### Security Measures

- **Firebase Authentication**: Secure token-based auth
- **Helmet.js**: Security headers
- **CORS**: Controlled cross-origin access
- **Rate Limiting**: Per-user and IP-based limits
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection**: Prevented by Mongoose ODM
- **XSS Protection**: React Native built-in protections
- **Secure Storage**: AsyncStorage for sensitive data
- **HTTPS Only**: Enforce TLS in production

### Scalability

- **Horizontal Scaling**: Stateless API servers can be scaled
- **Database Sharding**: MongoDB supports sharding for large datasets
- **Redis Cluster**: Can be clustered for high availability
- **OCR Workers**: Can be scaled independently
- **Cloudinary CDN**: Handles traffic spikes automatically

---

## Contact & Support

- **Repository**: https://github.com/s-a-b-i/ScanKaro
- **Issues**: https://github.com/s-a-b-i/ScanKaro/issues
- **Documentation**: See `README.md` for quick start guide

---

**Last Updated**: 2026-01-08  
**Version**: 1.0.0  
**Maintainers**: ScanKaro Team