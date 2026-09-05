# RelayPay

RelayPay is a system for offline, application-layer-secured payment
messages relayed over Bluetooth Low Energy. It uses a mock backend ledger only;
it is not connected to UPI, NPCI, a bank, or any real payment service.

The current mobile implementation includes the Phase 1 wallet and cryptography
module. BLE transport and backend settlement are not implemented yet.

## Prerequisites

- Node.js 22.11 or newer and npm
- PostgreSQL for backend persistence
- Android Studio, JDK 17, an Android SDK, and an Android emulator for the mobile app

## Install

From the repository root:

```sh
npm install
```

## Backend

Copy the example environment file and set `DATABASE_URL` to your PostgreSQL
database:

```sh
cp backend/.env.example backend/.env
npm run prisma:generate --workspace backend
npm run dev --workspace backend
```

The health endpoint is available at `http://localhost:3000/health` and returns
HTTP 200. The Phase 0 health endpoint does not require a database connection.

Useful checks:

```sh
npm run build --workspace backend
npm run lint --workspace backend
npm run format:check --workspace backend
npm run prisma:validate --workspace backend
```

## Mobile (Android)

Start an Android emulator from Android Studio, then run Metro and the Android
app in separate terminals:

```sh
npm run start --workspace mobile
npm run android --workspace mobile
```

Useful checks:

```sh
npm run build --workspace mobile
npm run lint --workspace mobile
npm run format:check --workspace mobile
npm run test --workspace mobile -- --runInBand
```

## Phase 1 wallet security

- Money is represented as integer paise. The offline bucket is capped at
  ₹5,000, and each transaction is capped at ₹1,000.
- New devices start with zero available and locked balance. Later backend sync
  code must populate available funds before `lockBalance` can reserve them for
  offline spending.
- Ed25519 and X25519 private keys are stored only through
  `react-native-keychain`; SQLite stores public keys, wallet balances, encrypted
  transactions, statuses, and seen nonces.
- Transactions are signed over a canonical payload and encrypted with
  XChaCha20-Poly1305. The one-time content key is sealed to the receiver's
  X25519 public key.
- Verification authenticates the signature before checking the timestamp or
  claiming the nonce. BLE is not involved in the Phase 1 test suite.

iOS is intentionally not the Phase 0 target. Later BLE relay work will remain
Android-first because iOS places significant restrictions on background BLE.
