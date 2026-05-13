# 🏥 Resculance Hospital Management System - Frontend

A modern, elegant React + Tailwind CSS frontend for the Resculance Smart Ambulance Management Platform.

## 🎨 Design Features

- **Black & White Theme**: Professional monochrome design with subtle accents
- **Smooth Animations**: Framer Motion powered transitions and interactions
- **Responsive Layout**: Mobile-first design that works on all devices
- **Modern UI Components**: Custom-built components with shadcn/ui inspiration
- **Interactive Charts**: Data visualization with Recharts

## 🚀 Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **State Management**: Zustand
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Yup validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **HTTP Client**: Axios

## 📦 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Table.jsx
│   │   └── common/          # Common components
│   ├── layouts/
│   │   └── MainLayout.jsx   # Sidebar + Topbar layout
│   ├── pages/
│   │   ├── auth/            # Login, Register
│   │   ├── dashboard/       # Dashboard with charts
│   │   ├── organizations/   # Hospital & Fleet management
│   │   ├── users/           # User management
│   │   ├── ambulances/      # Ambulance management
│   │   ├── patients/        # Patient management
│   │   ├── trips/           # Trip management
│   │   └── settings/        # Settings
│   ├── store/
│   │   └── authStore.js     # Zustand authentication store
│   ├── services/
│   │   ├── api.js           # Axios instance with interceptors
│   │   └── index.js         # API service methods
│   ├── routes/
│   │   └── ProtectedRoute.jsx
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Helper functions
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🛠️ Installation

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` and set your API URL:
```
VITE_API_URL=http://localhost:5000/api/v1
```

3. **Start development server:**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 🎯 Key Features

### Authentication
- ✅ Login with email/password
- ✅ User registration with role selection
- ✅ JWT token management with auto-refresh
- ✅ Protected routes
- ✅ Profile management

### Dashboard
- ✅ Statistics cards (Hospitals, Fleets, Ambulances, Active Trips)
- ✅ Weekly usage charts
- ✅ Ambulance type distribution
- ✅ Recent activity feed

### Organizations Management
- ✅ List all hospitals and fleet owners
- ✅ Filter by type (Hospital/Fleet)
- ✅ Search functionality
- ✅ Add/Edit/Delete organizations
- ✅ View organization details

### User Management
- ✅ List users with role-based tabs
- ✅ Approve/Reject pending users
- ✅ Add/Edit/Deactivate users
- ✅ Search functionality
- ✅ Filter by role and status

### UI Components
- ✅ Button (multiple variants and sizes)
- ✅ Input (with validation support)
- ✅ Card (with hover effects)
- ✅ Modal (animated with overlay)
- ✅ Table (sortable and interactive)

## 🎨 Design System

### Colors
```js
Primary: #000000 (Black)
Secondary: #555555 (Dark Gray)
Background: #ffffff (White)
Card Background: #f8f8f8 (Light Gray)
Border: #e5e5e5 (Light Border)
```

### Typography
- **Display Font**: Poppins (headings)
- **Body Font**: Inter (content)

### Animations
- **Page transitions**: Fade in + slide up
- **Hover effects**: Scale 1.03 + shadow
- **Button interactions**: Smooth scale transitions

## 📱 Responsive Design

- **Mobile**: < 768px (Collapsible sidebar)
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 🔐 Authentication Flow

1. User enters credentials on login page
2. API returns access token + refresh token
3. Tokens stored in localStorage
4. Access token sent with every API request
5. Auto-refresh on token expiration
6. Logout clears tokens and redirects to login

## 🌐 API Integration

All API endpoints from the Postman collection are integrated:

### Auth Endpoints
- POST `/auth/login`
- POST `/auth/register`
- GET `/auth/profile`
- PUT `/auth/profile`
- POST `/auth/change-password`
- POST `/auth/refresh`

### Organizations
- GET `/organizations`
- GET `/organizations/:id`
- POST `/organizations`
- PUT `/organizations/:id`
- DELETE `/organizations/:id`

### Users
- GET `/users`
- GET `/users/:id`
- POST `/users`
- PUT `/users/:id`
- POST `/users/:id/approve`
- POST `/users/:id/reject`
- POST `/users/:id/deactivate`
- DELETE `/users/:id`

### Ambulances, Patients, etc.
All other endpoints are implemented in `services/index.js`

## 🚀 Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

### Preview production build:
```bash
npm run preview
```

## 🎓 Usage

### Default Login Credentials
Use the credentials from your backend seeded data:
```
Email: superadmin@resculance.com
Password: Admin@123
```

### Creating New Users
1. Navigate to Users page
2. Click "Add User" button
3. Fill in the form
4. Submit for approval (if required by role)

### Managing Organizations
1. Navigate to Organizations page
2. Filter by Hospital or Fleet
3. Add new organizations with all required details
4. Edit or delete existing entries

## 📝 Customization

### Changing Colors
Edit `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: '#000000' },
      // Add your custom colors
    }
  }
}
```

### Adding New Pages
1. Create page component in `src/pages/`
2. Add route in `App.jsx`
3. Update sidebar navigation in `MainLayout.jsx`

## 🐛 Troubleshooting

### Issue: API requests failing
- Check `.env` file has correct API URL
- Verify backend is running on specified port
- Check browser console for CORS errors

### Issue: Authentication not working
- Clear localStorage and try logging in again
- Verify tokens are being stored correctly
- Check API response format matches expected structure

### Issue: Styles not loading
- Run `npm install` to ensure Tailwind is installed
- Check `tailwind.config.js` content paths
- Verify `@tailwind` directives in `index.css`

## 📄 License

This project is part of the Resculance platform.

## 👥 Support

For issues or questions, please contact the development team.

---

Built with ❤️ using React + Tailwind CSS
