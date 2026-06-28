# SafeEscrow — Secure Marketplace & Escrow Platform

A full-stack escrow marketplace platform that enables **secure peer-to-peer transactions** with a trusted third-party escrow workflow. Buyers and sellers can transact with confidence through a multi-step verification process, real-time messaging, and administrative oversight.

---

## Features

### Escrow Engine
- Full escrow lifecycle: payment submission → verification → seller packaging evidence → delivery tracking → buyer confirmation → funds release
- Dispute resolution with admin mediation and evidence uploads
- Payment method support: **Crypto** (BTC, USDT-TRC20, USDT-ERC20, ETH, SOL, BNB), **Venmo**, **CashApp**, **Zelle**
- Automatic timeline tracking at every stage

### Marketplace
- Rich listing creation with images, categories, pricing, and conditions
- Advanced filtering, search, and category browsing
- Featured listings with admin-controlled sort order
- Favorites and watchlist functionality

### User System
- JWT-based authentication with email/password
- Role-based access: `admin`, `buyer`, `seller`, `both`
- Profile management with avatar uploads
- Seller verification request workflow

### Messaging
- Real-time chat via Socket.IO with typing indicators
- Conversation management with unread tracking
- File/image attachment support in messages
- Admin oversight panel

### Wallet & Payments
- User wallets with balance and pending balance tracking
- Admin-managed payout system
- Multi-currency support (USD, EUR, GBP, AUD, CAD, JPY, CNY, INR, BRL)
- Live exchange rate integration

### Admin Panel
- Comprehensive dashboard with analytics (users, listings, escrow volume)
- User management with role assignment and identity verification
- Escrow case management (payment verification, delivery tracking, dispute resolution)
- Category, listing, and featured content management
- Payment settings configuration
- Wallet and payout administration
- Full audit logging

---

## Tech Stack

| Layer          | Technology                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| **Frontend**   | React 18, TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui, Radix UI         |
| **State**      | Zustand, TanStack React Query, Redux Toolkit                              |
| **Backend**    | Express.js 4, TypeScript (tsx), Socket.IO                                  |
| **Database**   | PostgreSQL via `node-postgres` (`pg`)                                      |
| **Auth**       | JSON Web Tokens (jsonwebtoken), bcryptjs                                   |
| **Real-time**  | Socket.IO with JWT-authenticated rooms                                     |
| **Charts**     | Recharts, Chart.js                                                         |
| **3D**         | Three.js, @react-three/fiber                                               |
| **Payments**   | QR code generation                                                    |
| **PWA**        | Vite PWA plugin with Workbox                                               |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Frontend (Vite :3000)                 │
│  React + TypeScript + Tailwind + shadcn/ui            │
│  ┌──────────────────────────────────────────────────┐ │
│  │   Proxy /api → localhost:3001                    │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼───────────────────────────────┐
│                 Express API (:3001)                    │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │   Auth   │  │  Routes  │  │  Socket.IO Server  │  │
│  └──────────┘  └────┬─────┘  └────────────────────┘  │
│                     │                                  │
│              ┌──────▼──────┐                          │
│              │  PostgreSQL  │                          │
│              └─────────────┘                          │
└──────────────────────────────────────────────────────┘
```

In production, the Express server serves the compiled frontend from `dist/`, allowing single-port deployment.

---

## Getting Started

### Prerequisites
- **Node.js** ≥ 20
- **PostgreSQL** database

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd safeescrow

# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://user:password@host:5432/safeescrow
JWT_SECRET=your-secure-random-jwt-secret
```

### 3. Database Setup

The server automatically runs migrations on startup — tables are created if they don't exist. To run migrations manually:

```bash
cd server && npm run migrate
```

To populate with test data:

```bash
cd server && npm run seed
```

Test accounts after seeding:
| Role   | Email                    | Password    |
| ------ | ------------------------ | ----------- |
| Admin  | admin@safeescrow.com     | password123 |
| Buyer  | buyer@example.com        | password123 |
| Seller | seller@example.com       | password123 |

### 4. Start Development

```bash
# Terminal 1: Frontend dev server
npm run dev

# Terminal 2: Backend API server
cd server && npm run dev
```

The frontend runs on **http://localhost:3000** and proxies `/api` requests to the backend on port 3001.

---

## Available Scripts

### Root (Frontend)

| Script        | Description                     |
| ------------- | ------------------------------- |
| `npm run dev` | Start Vite dev server           |
| `npm run build` | Production build to `dist/`   |
| `npm run lint` | Run ESLint                      |
| `npm run preview` | Preview production build     |

### Server (Backend)

| Script                 | Description                       |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Dev server with hot reload        |
| `npm run start`        | Production start                  |
| `npm run migrate`      | Run database migrations           |
| `npm run seed`         | Seed database with test data      |

---

## API Overview

### Public Endpoints
- `GET /api/categories` — All categories
- `GET /api/listings` — Paginated listings with filters
- `GET /api/listings/:id` — Single listing details
- `GET /api/featured-listings` — Featured listings
- `GET /api/currency/rates` — Live exchange rates
- `GET /api/currency/convert` — Currency conversion
- `POST /api/auth/login` — User login
- `POST /api/auth/register` — User registration

### Authenticated Endpoints
- `GET/PUT /api/auth/me` — Current user profile
- `GET/POST /api/escrow` — User's escrow cases
- `GET/PUT/DELETE /api/escrow/:id` — Single escrow case
- `GET/POST /api/messages` — Messaging
- `GET/POST /api/conversations` — Conversations
- `GET/POST /api/favorites` — Saved listings
- `POST /api/listings` — Create a listing (seller)
- `GET /api/wallet` — User's wallet
- `GET /api/notifications` — User notifications

### Admin Endpoints (requires admin role)
- `GET/POST/PUT/DELETE /api/admin/users` — User management
- `GET/PUT/DELETE /api/admin/listings` — Listing management
- `GET/PUT/DELETE /api/admin/escrow` — Escrow administration
- `GET/PUT /api/admin/wallets` — Wallet administration
- `GET/POST /api/admin/payment-settings` — Payment configuration
- `GET /api/admin/analytics` — Platform analytics
- `GET /api/admin/audit-logs` — Audit trail

---

## Project Structure

```
safeescrow/
├── src/                          # Frontend React app
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── features/             # ListingCard, EscrowTimeline, etc.
│   │   └── layout/               # Navbar, AdminSidebar
│   ├── pages/                    # All route pages
│   │   ├── admin/                # 17 admin panel pages
│   │   └── ...                   # Public & user pages
│   ├── hooks/                    # useAuth, useSocket, etc.
│   ├── lib/                      # API client, utils, stores
│   ├── constants/                # Status configs, enums
│   └── types/                    # TypeScript interfaces
├── server/                       # Express backend
│   └── src/
│       ├── routes/               # API route handlers
│       │   └── admin/            # Admin-specific routes
│       ├── middleware/           # Auth & admin middleware
│       ├── db.ts                 # PostgreSQL connection
│       ├── index.ts              # Server entry + migrations
│       ├── socket.ts             # Socket.IO setup
│       └── seed.ts               # Test data seeder
├── public/                       # Static assets
├── dist/                         # Production build output
├── railway.json                  # Railway deployment config
└── vite.config.ts                # Vite configuration
```

---

## Database Schema (Key Tables)

| Table               | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| `user_profiles`     | Users, roles, verification status                |
| `listings`          | Marketplace listings with images and metadata    |
| `escrow_cases`      | Core escrow transactions (full lifecycle)        |
| `escrow_timeline`   | Chronological event log for each escrow case     |
| `notifications`     | User notifications with read tracking            |
| `conversations`     | Buyer-seller conversation threads                |
| `messages`          | Chat messages with file attachments              |
| `wallets`           | User balances and pending funds                  |
| `wallet_transactions` | Financial transaction history                  |
| `payment_settings`  | Admin-managed payment method configurations      |
| `categories`        | Product category tree with sort order            |
| `featured_listings` | Curated listings with admin sort order           |
| `seller_requests`   | Seller verification request workflow             |
| `payouts`           | Admin-initiated payout records                   |
| `dispute_evidence`  | Files attached to dispute cases                  |
| `audit_logs`        | Administrative action audit trail                |
| `uploaded_files`    | Base64-encoded file storage                      |

---

## Deployment

The project is configured for deployment on **Railway** (see `railway.json`). The build process compiles the frontend, and the Express server serves both the API and static files from a single port.

Alternatively, you can deploy to any Node.js-compatible platform:

```bash
# 1. Build frontend
npm run build

# 2. Start server (serves API + frontend)
cd server && npm run start
```

Ensure the `DATABASE_URL` and `JWT_SECRET` environment variables are set in your production environment.

---

## License

This project is proprietary software. All rights reserved.