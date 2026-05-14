# resculance Mobile (Expo SDK 54)

Paramedic-focused mobile companion to the resculance backend, built with
Expo SDK 54 + expo-router (plain JavaScript, no TypeScript). Same `/api/v1`
REST API and Socket.IO channel as [the web frontend](../frontend), with a
design system that mirrors the frontend's tokens (teal primary `#14B8A6`,
Inter / Poppins typography, rounded-2xl cards, light + dark mode).

## Screens

**Auth + boot**
- **Branded splash** — native (teal) splash hands off to an in-app
  splash with pulsing logo while fonts + auth bootstrap finish.
- **Login** — centered card with logo, teal focus rings, forgot-password
  link, footer hint.

**Tab navigator (5 tabs)**
- **Home / Dashboard** — greeting + role badge, active-session banner,
  stat cards (active trips, ambulances, patients, partnerships) sourced
  from `/dashboard/stats`, my-ambulance shortcut, quick actions.
- **My ambulance** — assigned ambulance(s) with status pill, vehicle /
  operator / location metadata, active-session deep link, "Onboard
  patient" CTA.
- **Sessions** — segmented Active / History list with patient avatar,
  destination, status tone.
- **Alerts** — notifications with live socket prepending, tap-to-read,
  per-type icons + tones, unread badge on the tab bar.
- **Profile** — identity card with avatar, organization, list links to
  Settings / About / Help, danger sign-out.

**Stack screens**
- **Session detail** (`/session/[id]`) — patient header strip,
  segmented Chat / Vitals / Info with live socket updates.
  - Chat: bubbles with role labels, teal "you" bubbles, multiline composer.
  - Vitals: card list + FAB → modal form (HR, BP, Temp, SpO₂, etc.).
  - Info: patient (tap → patient detail), ambulance, trip, crew, offboard.
- **Patient detail** (`/patient/[id]`) — hero avatar + status badges,
  allergy warning banner, tappable contact rows (phone / email open the
  dialer / mail), emergency contact, medical history, recent 5 vitals.
- **Onboard flow** — three steps:
  - `/onboard` — search `/patients/available` (debounced), or create new.
  - `/onboard/new-patient` — sectioned form (basic / contact / medical).
  - `/onboard/[patientId]` — patient card, radio-style ambulance picker,
    trip-details inputs, big "Onboard patient" button.
- **Settings** (`/settings`) — theme picker (Auto / Light / Dark, stored
  to SecureStore), account info, connectivity (API + socket URLs),
  About link, sign-out.
- **About** (`/about`) — logo, version, "what this app does", "built
  with", external links.

## Design system

Tokens live in [src/theme/index.js](src/theme/index.js) and primitives
in [src/ui/](src/ui/). Everything matches the web frontend:

| Token | Value |
|---|---|
| Primary | `#14B8A6` (teal) |
| Card radius | 16px (rounded-2xl) |
| Body font | Inter (400/500/600/700) |
| Display font | Poppins (600/700) |
| Light bg / card | `#F9FAFB` / `#FFFFFF` |
| Dark bg / card | `#111827` / `#1F2937` |

Theme follows the device by default; user can override in **Settings →
Appearance**. Preference persists across launches.

UI primitives: `Screen`, `Card`, `Button`, `Input`, `Badge`,
`EmptyState`, `SectionHeader`, `LogoMark`, `Wordmark`, `SplashScreen`,
plus typography (`Display`, `H1`, `H2`, `H3`, `Body`, `BodyStrong`,
`Small`, `Caption`, `Overline`).

## Setup

```bash
cd mobile-app
npm install
cp .env.example .env
# edit .env so EXPO_PUBLIC_API_URL points at your backend
npm run start          # opens Expo Dev Tools
```

Then press `i` for iOS simulator, `a` for Android emulator, or scan the QR
code in [Expo Go](https://expo.dev/client) on your phone.

### Pointing at the backend

| Where you run the app | What `EXPO_PUBLIC_API_URL` should be |
|---|---|
| iOS Simulator | `http://localhost:5000/api/v1` |
| Android Emulator | `http://10.0.2.2:5000/api/v1` |
| Physical device, Expo Go | `http://<your-mac-LAN-IP>:5000/api/v1` (e.g. `http://192.168.1.42:5000/api/v1`) |

Find your Mac's LAN IP with `ipconfig getifaddr en0`. Your phone needs to
be on the same Wi-Fi as the backend, and macOS firewall must allow the
backend's port. The Socket.IO URL is derived automatically (strips
`/api/vN`), or override with `EXPO_PUBLIC_SOCKET_URL`.

### Default test accounts

After running `npm run seed:sample` in the backend, log in with the
paramedic accounts listed in [../README.md](../README.md).

## Project layout

```
mobile-app/
├── app/                                # expo-router file-based routes
│   ├── _layout.jsx                     # fonts + splash control + auth gate
│   ├── login.jsx
│   ├── (tabs)/
│   │   ├── _layout.jsx                 # tab bar + unread badge
│   │   ├── index.jsx                   # Home / Dashboard
│   │   ├── ambulance.jsx               # My ambulance
│   │   ├── sessions.jsx
│   │   ├── notifications.jsx
│   │   └── profile.jsx
│   ├── session/[id].jsx
│   ├── patient/[id].jsx
│   ├── onboard/
│   │   ├── index.jsx
│   │   ├── new-patient.jsx
│   │   └── [patientId].jsx
│   ├── settings.jsx
│   └── about.jsx
├── src/
│   ├── api/                            # axios client + per-resource modules
│   │   ├── client.js                   # Auth header + auto-refresh
│   │   ├── auth.js
│   │   ├── ambulances.js
│   │   ├── sessions.js
│   │   ├── patients.js
│   │   ├── notifications.js
│   │   └── dashboard.js
│   ├── socket/client.js                # Socket.IO singleton w/ JWT handshake
│   ├── store/auth.js                   # Zustand auth state + theme pref
│   ├── lib/
│   │   ├── config.js                   # API_URL / SOCKET_URL
│   │   └── storage.js                  # SecureStore / AsyncStorage
│   ├── theme/index.js                  # tokens + useTheme()
│   └── ui/                             # Card, Button, Input, Screen, Badge, …
├── app.config.js                       # dynamic config (reads EXPO_PUBLIC_API_URL)
├── .env.example
└── package.json
```

## Notes on the API integration

- The backend's login response is `{ data: { user, accessToken, refreshToken } }`
  (note the `data` envelope). The axios client unwraps this automatically.
- Auth tokens persist in `expo-secure-store` on iOS/Android and
  `AsyncStorage` on web (SecureStore is native-only).
- Socket.IO authentication uses `auth: { token }` in the handshake — same
  pattern as the web client.
- Message events come in two flavors on the same room:
  - `new_message` from HTTP POST `/patients/sessions/:id/messages`
  - `message` from a direct socket `message` emit
  Both are normalized (camelCase → snake_case) and deduped by `id` so the
  echo of a just-sent message doesn't show twice.

## Useful scripts

```bash
npm run start           # Metro / Expo Dev Tools
npm run ios             # Open in iOS simulator
npm run android         # Open in Android emulator
npm run web             # Run as a web app
npm run lint            # eslint-config-expo
```

## Roadmap

- Push notifications via `expo-notifications` so the bell badge works when
  the app is backgrounded.
- Background GPS streaming → POST `/ambulances/:id/location` while a session
  is active (requires `expo-location` foreground service on Android).
- File uploads (X-ray photos, etc.) → POST `/sessions/:id/data/upload`
  using `expo-image-picker` + `expo-document-picker`.
- Jitsi video call screen via `react-native-jitsi-meet`.
- Live camera feed (vehicleview.live) viewer.
- Org / user admin screens for hospital and fleet admins.
- Collaborations / partnerships management.
