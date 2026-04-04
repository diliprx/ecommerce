# 🛒 ShopNext — Production-Grade E-Commerce Platform

Full-stack e-commerce system built with **Next.js 14 App Router** + **FastAPI** + **MySQL** + **SQLAlchemy**.  
Designed to OWASP Top 10 standards with enterprise clean architecture.

---

## 📁 Complete Folder Structure

```
ecommerce/
├── docker-compose.yml
│
├── backend/                          FastAPI application
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── schema.sql                    Raw SQL schema (source of truth)
│   ├── .env.example
│   ├── migrations/
│   │   └── env.py                    Alembic config
│   ├── tests/
│   │   ├── test_auth.py              Auth + security tests
│   │   └── test_products_cart.py     Product + cart tests
│   └── app/
│       ├── main.py                   FastAPI factory + middleware
│       ├── api/
│       │   ├── deps.py               Dependency injection (auth guards)
│       │   └── v1/endpoints/
│       │       ├── auth.py           POST /register /login /refresh-token /logout
│       │       ├── products.py       GET /products, GET /products/{id}, POST /products
│       │       ├── cart.py           GET /cart, POST /cart/add, DELETE /cart/remove
│       │       ├── orders.py         POST /orders/create, GET /orders
│       │       └── webhooks.py       POST /webhooks/stripe
│       ├── core/
│       │   ├── config.py             Pydantic-settings (env validation)
│       │   └── security.py           JWT, bcrypt, refresh tokens
│       ├── db/
│       │   ├── base.py               DeclarativeBase
│       │   └── session.py            Engine + SessionLocal + get_db
│       ├── models/
│       │   └── models.py             All ORM models (mirrors schema.sql)
│       ├── repositories/
│       │   └── repositories.py       DB layer (ORM only, no raw SQL)
│       ├── schemas/
│       │   └── schemas.py            Pydantic v2 request/response models
│       ├── services/
│       │   └── services.py           Business logic orchestration
│       ├── middleware/
│       │   └── security.py           Security headers + request logging
│       └── utils/
│           └── logger.py             structlog JSON logging
│
└── frontend/                         Next.js 14 App Router
    ├── Dockerfile
    ├── package.json
    ├── next.config.js                Security headers + image domains
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── app/
        │   ├── layout.tsx            Root layout + Navbar
        │   ├── globals.css
        │   ├── auth/
        │   │   ├── login/page.tsx    Sign-in form (Zod + react-hook-form)
        │   │   └── register/page.tsx Registration with password strength
        │   ├── products/
        │   │   ├── page.tsx          SSR product listing + pagination
        │   │   └── [id]/page.tsx     SSR product detail + ISR
        │   ├── cart/
        │   │   └── page.tsx          Client cart with auth guard
        │   └── orders/
        │       ├── page.tsx          Order history
        │       └── checkout/page.tsx Stripe Elements payment
        ├── components/
        │   ├── layout/Navbar.tsx
        │   ├── product/
        │   │   ├── ProductGrid.tsx
        │   │   ├── ProductFiltersBar.tsx
        │   │   └── AddToCartButton.tsx
        │   └── ui/Pagination.tsx
        ├── hooks/useAuth.ts          Login / register / logout actions
        ├── lib/api.ts                Axios + token refresh interceptor
        ├── store/
        │   ├── authStore.ts          Zustand (token in memory, never localStorage)
        │   └── cartStore.ts          Zustand cart state
        └── types/index.ts            Shared TypeScript types
```

---

## 🗄️ Database Schema Design

### Normalization (3NF)
All tables satisfy Third Normal Form:
- Every non-key attribute depends on the **whole** primary key
- No transitive dependencies
- Lookup values extracted to reference tables (roles, categories)

### Key Design Decisions

| Decision | Reasoning |
|----------|-----------|
| `password_hash` column (bcrypt $2b$12$) | Passwords never stored plaintext. Cost factor 12 resists GPU brute force |
| `price_at_purchase` in `order_items` | Snapshot prevents historical orders changing when product price changes |
| `deleted_at` soft delete | Audit trail preserved; foreign keys remain intact |
| `SELECT ... FOR UPDATE` on stock | Pessimistic locking prevents overselling under concurrent load |
| `refresh_tokens.token_hash` (SHA-256) | DB breach doesn't yield usable tokens |
| `payments` stores only `transaction_id` | PCI DSS: card numbers/CVV never touch our system |
| FULLTEXT index on `products(name, description)` | Fast keyword search without Elasticsearch for moderate scale |
| Composite UNIQUE on `cart_items(cart_id, product_id)` | Prevents duplicate line items at DB level |

---

## 🔌 API Reference

### Auth
```
POST   /api/v1/auth/register         Create account
POST   /api/v1/auth/login            Returns access token (body) + refresh token (HTTP-only cookie)
POST   /api/v1/auth/refresh-token    Rotate refresh token
POST   /api/v1/auth/logout           Revoke all refresh tokens
GET    /api/v1/auth/me               Current user profile
```

### Products
```
GET    /api/v1/products              List (page, limit, search, category_id, min_price, max_price)
GET    /api/v1/products/{id}         Single product
POST   /api/v1/products              Create [Admin only]
```

### Cart
```
GET    /api/v1/cart                  View cart
POST   /api/v1/cart/add              Add item {product_id, quantity}
DELETE /api/v1/cart/remove           Remove item {product_id}
```

### Orders
```
POST   /api/v1/orders/create         Create from cart (locks stock atomically)
GET    /api/v1/orders                List user orders
GET    /api/v1/orders/{id}           Order detail
POST   /api/v1/orders/payment-intent Get Stripe client_secret
```

### Webhooks
```
POST   /api/v1/webhooks/stripe       Stripe webhook (signature verified)
```

---

## 🔐 Security Architecture

### OWASP Top 10 Coverage

#### A01 – Broken Access Control
- JWT validated on every protected request via `get_current_user` dependency
- Role-based access: `require_admin` dependency blocks non-admin users
- Order/address lookups always filter by `user_id` — users can't access other users' data
- Soft-delete check: `deleted_at IS NULL` prevents accessing deleted accounts

#### A02 – Cryptographic Failures
- Passwords: bcrypt with cost factor 12 (configurable)
- JWT: HS256 with 64-byte random secret (generated with `secrets.token_hex(64)`)
- Access tokens expire in **15 minutes**
- Refresh tokens: 256-bit random secret, stored as SHA-256 hash in DB
- Payment: Stripe handles card encryption; we store only `transaction_id`
- HTTPS enforced via `Strict-Transport-Security` header

#### A03 – Injection
- **100% SQLAlchemy ORM** — zero raw SQL strings anywhere in the codebase
- Pydantic validates and strictly types all inputs before they reach the DB layer
- Email normalized and validated via `EmailStr` (rejects injection attempts at schema level)

#### A04 – Insecure Design
- Refresh token **rotation**: old token revoked on each use
- `revoke_all_for_user()` allows emergency session termination
- Stock decrement uses `SELECT FOR UPDATE` — prevents race condition overselling
- Price captured at purchase time — order history is immutable to price changes

#### A05 – Security Misconfiguration
- CORS restricted to explicit `ALLOWED_ORIGINS` list (no `*`)
- Docs (`/api/docs`) disabled in production (`APP_ENV=production`)
- `poweredByHeader: false` — Next.js version not advertised
- Security headers on every response (both FastAPI middleware and Next.js config)

#### A07 – Authentication Failures
- Login rate-limited: **5 requests/minute per IP** (slowapi)
- Timing-safe password check: dummy hash verified even for non-existent users
- Login failure logged (email only — no password in logs)
- Generic error message for both "wrong email" and "wrong password" (prevents enumeration)

#### A08 – Software and Data Integrity
- Stripe webhook signature verified with `stripe.Webhook.construct_event()`
- Unsigned webhooks rejected with 400

#### A09 – Logging & Monitoring Failures
- Structured JSON logs via structlog in production
- Request ID on every response for tracing
- Errors logged internally with full context; clients get generic message only
- Sensitive fields (Authorization, Cookie) never logged

#### A10 – Server-Side Request Forgery
- No user-supplied URLs are fetched server-side
- Image URLs stored as text; rendering handled by client with `next/image` domain allowlist

### Frontend Security

| Mechanism | Implementation |
|-----------|----------------|
| Access token storage | Zustand in-memory state (not localStorage — XSS resistant) |
| Refresh token storage | HTTP-only, Secure, SameSite=Strict cookie (JS-inaccessible) |
| XSS prevention | `_strip_html()` on all text inputs + CSP headers |
| CSRF protection | SameSite=Strict cookie + CORS origin restriction |
| Input validation | Zod schemas on frontend + Pydantic on backend (dual layer) |
| Secure headers | Both Next.js config and FastAPI middleware apply security headers |

---

## ⚡ Performance Optimizations

### Backend
- **Connection pooling**: `pool_size=10`, `max_overflow=20`, `pool_pre_ping=True`
- **Eager loading**: `joinedload` / `selectinload` prevents N+1 queries
- **Indexes**: email, product_id, order_id, category_id, deleted_at
- **Pagination**: limit/offset with count query (cursor-based recommended for >1M rows)
- **Stock locking**: `SELECT FOR UPDATE` scoped to the transaction — minimal lock time

### Frontend
- **Server Components**: product listing and detail pages are SSR/ISR (no client JS for initial render)
- **ISR**: `next: { revalidate: 60 }` — product pages revalidate every 60s without full rebuild
- **`next/image`**: automatic WebP/AVIF conversion, lazy loading, `sizes` for responsive images
- **Code splitting**: Next.js automatically splits by route
- **Suspense boundaries**: prevents full-page loading states
- **URL-driven filters**: shareable, browser-history-compatible, no client state for search params

---

## 🧪 Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v --tb=short

# With coverage
pytest tests/ --cov=app --cov-report=term-missing
```

Tests use SQLite in-memory (no MySQL required for CI).

---

## 🚀 Quick Start (Production)

```bash
# 1. Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files: DB creds, JWT_SECRET_KEY, Stripe keys, etc.

# 2. Full stack (recommended)
docker compose up --build -d

# 3. Access
Frontend: http://localhost:3000
API docs: http://localhost:8000/api/docs (dev only)
API:      http://localhost:8000/api/v1

# 4. Migrations (first time)
docker compose exec backend alembic upgrade head
```

## 🔧 Development (Hot Reload)

### Option 1: Script (Recommended)
```bash
# From project root (ecommerce/)
./backend/run_dev.sh
```

### Option 2: Manual
```bash
cd backend
call venv\\Scripts\\activate
pip install -r requirements.txt  # if needed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**✅ Auto-installs deps, activates venv, starts with reload. Ctrl+C to stop.**

**New tab:** `cd frontend && npm run dev` for frontend hot reload.

### Verify Backend
```bash
curl http://localhost:8000/health
# {"status": "ok", "version": "1.0.0"}
```


---

## 🔑 Environment Variables

### Backend (required)
| Variable | Description |
|----------|-------------|
| `DB_USER`, `DB_PASSWORD` | MySQL credentials |
| `JWT_SECRET_KEY` | 64-byte hex string (`python -c "import secrets; print(secrets.token_hex(64))"`) |
| `STRIPE_SECRET_KEY` | Stripe server key (never expose to frontend) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe dashboard webhook settings |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins |

### Frontend (required)
| Variable | Description |
|----------|-------------|
| `API_BASE_URL` | Backend URL (server-side only, no NEXT_PUBLIC_) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Safe to expose — Stripe's public key |

---

## 📦 Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | Next.js App Router | 14.x |
| Frontend state | Zustand | 4.x |
| Frontend forms | react-hook-form + Zod | 7.x / 3.x |
| Backend framework | FastAPI | 0.111 |
| ORM | SQLAlchemy | 2.0 |
| DB migrations | Alembic | 1.13 |
| Database | MySQL | 8.0 |
| Auth | python-jose + passlib[bcrypt] | 3.3 / 1.7 |
| Rate limiting | slowapi | 0.1.9 |
| Payments | Stripe | 9.x |
| Logging | structlog | 24.x |
| Container | Docker + Compose | - |
