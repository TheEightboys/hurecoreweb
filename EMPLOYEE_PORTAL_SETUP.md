# HURE Core - Employee/Staff Dashboard Setup Complete

## ✅ What Was Created

### Backend API Routes (Already Done)
1. **routes/employee.js** - 8 employee portal endpoints
   - GET `/api/employee/profile` - Get staff profile
   - PATCH `/api/employee/profile` - Update profile
   - GET `/api/employee/schedule` - View assigned shifts
   - PATCH `/api/employee/schedule/:shiftId/respond` - Confirm/decline shifts
   - GET `/api/employee/attendance` - View attendance history
   - POST `/api/employee/attendance/clock-in` - Clock in
   - POST `/api/employee/attendance/clock-out` - Clock out
   - GET `/api/employee/leave` - View leave requests
   - POST `/api/employee/leave` - Submit leave request
   - GET `/api/employee/documents` - View clinic documents
   - POST `/api/employee/documents/:docId/acknowledge` - Acknowledge document

2. **routes/staff.js** - Updated with staff authentication
   - POST `/:clinicId/staff/:staffId/invite` - Send invite email
   - GET `/api/staff/verify-invite` - Verify invite token
   - POST `/api/staff/accept-invite` - Accept invite & set password
   - POST `/api/staff/login` - Staff login

3. **server.js** - Mounted new routes
   - `/api/staff` - Public staff auth endpoints
   - `/api/employee` - Protected employee portal (requires JWT)

### Frontend Components (Just Created)
1. **frontend/src/employeeApi.js** - API client for employee portal
2. **frontend/src/AcceptInvite.jsx** - Invite acceptance page
3. **frontend/src/StaffLogin.jsx** - Staff login page
4. **frontend/src/EmployeeDashboard.jsx** - Full employee dashboard with:
   - Dashboard overview
   - My Schedule (view shifts, confirm/decline)
   - My Attendance (clock in/out, export CSV)
   - My Leave (request leave, view status)
   - Docs & Policies (view & acknowledge)
   - Profile (edit contact & license info)

5. **frontend/src/Router.jsx** - Updated with employee routes:
   - `/employee/accept-invite` - Accept invite page
   - `/employee/login` - Staff login
   - `/employee` - Employee dashboard

## 🔄 Complete Workflow

### 1. Employer Invites Staff
- Employer logs into `/employer` dashboard
- Goes to Staff Management → Add Staff
- Fills in staff details and clicks "Send Invite"
- Backend sends email via Brevo with invite link

### 2. Staff Receives Invite Email
Email contains link like:
```
http://localhost:5174/employee/accept-invite?token=<32-byte-hex-token>
```

### 3. Staff Accepts Invite
- Staff clicks link → AcceptInvite page loads
- Page verifies token is valid and not expired (24 hours)
- Staff sees their name, email, role, clinic
- Staff creates password (min 8 chars)
- Backend hashes password with bcrypt
- Backend generates JWT with staffId
- Staff redirected to `/employee` dashboard

### 4. Staff Uses Portal
- View assigned shifts
- Confirm or decline shifts
- Clock in/out for attendance
- Request leave
- View and acknowledge clinic documents
- Update contact info & license details

### 5. Return Login
- Staff can later login at `/employee/login`
- Uses email + password
- Gets JWT token
- Access employee dashboard

## 📋 Testing Checklist

### Backend API Tests
- [ ] POST /:clinicId/staff (create staff member)
- [ ] POST /:clinicId/staff/:staffId/invite (send invite email)
- [ ] GET /api/staff/verify-invite?token=xxx (verify token)
- [ ] POST /api/staff/accept-invite (set password)
- [ ] POST /api/staff/login (login with email/password)
- [ ] GET /api/employee/profile (get staff profile)
- [ ] PATCH /api/employee/profile (update profile)
- [ ] GET /api/employee/schedule (view shifts)
- [ ] PATCH /api/employee/schedule/:id/respond (confirm/decline)
- [ ] POST /api/employee/attendance/clock-in
- [ ] POST /api/employee/attendance/clock-out
- [ ] GET /api/employee/attendance
- [ ] POST /api/employee/leave (submit request)
- [ ] GET /api/employee/leave (view requests)
- [ ] GET /api/employee/documents
- [ ] POST /api/employee/documents/:id/acknowledge

### Frontend Tests
- [ ] Navigate to /employee/accept-invite with token
- [ ] Verify token validation works
- [ ] Accept invite and set password
- [ ] Redirect to employee dashboard
- [ ] View dashboard overview
- [ ] View schedule and confirm/decline shifts
- [ ] Clock in/out
- [ ] Export attendance CSV
- [ ] Submit leave request
- [ ] Acknowledge documents
- [ ] Edit profile
- [ ] Logout and login again at /employee/login

## 🔐 Security Features

1. **JWT Authentication** - All employee endpoints require valid staff token
2. **Password Hashing** - bcrypt with salt rounds
3. **Token Expiry** - Invite tokens expire in 24 hours
4. **Clinic Scoping** - Staff can only see data from their clinic
5. **Limited Updates** - Staff can only update phone, email, license fields

## 🚀 Next Steps

1. **Start Backend Server**
   ```bash
   cd d:\hurenew
   node server.js
   ```

2. **Start Frontend Dev Server**
   ```bash
   cd d:\hurenew\frontend
   npm run dev
   ```

3. **Test Invite Flow**
   - Login as employer at http://localhost:5174/employer
   - Create a staff member
   - Send invite
   - Check email inbox for invite link
   - Click link to accept invite
   - Set password and access employee dashboard

## 📝 Database Schema

The employee portal uses these tables (already created):
- `staff` - Staff member details, invite tokens, passwords
- `shifts` - Shift assignments
- `attendances` - Clock in/out records
- `leave_requests` - Leave applications
- `documents` - Clinic policies/documents
- `document_acknowledgments` - Staff acknowledgments
- `clinic_locations` - Multi-branch support

## 🎨 UI Features

- Modern Tailwind CSS design
- Responsive layout
- Sidebar navigation
- Dashboard widgets
- Action cards
- License expiry warnings
- Modal forms
- CSV export
- Loading states
- Error handling

## 📧 Email Integration

Uses Brevo API to send:
- Staff invite emails with secure token links
- Email sent from: theboysofficialone@gmail.com
- APP_URL set to http://localhost:5174 for development

---

**Status**: ✅ COMPLETE - Ready for testing!
