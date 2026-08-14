# CampusFlora Admin Dashboard - Complete Setup Guide

## Overview

This guide explains how to set up and fix the CampusFlora admin dashboard with proper Supabase authentication, database connection, and row-level security (RLS).

## What Was Fixed

### 1. **Error Logging** ✅
- AdminDashboard now logs actual Supabase errors to the console
- Error messages display the real database error instead of a generic "Unable to connect"
- Errors include: message, details, hint, and error code

### 2. **Authentication Flow** ✅
- Auth.tsx now checks user role and redirects admins to `/admin` after login
- Normal users are redirected to `/`
- AdminLogin.tsx no longer hardcodes admin email or username

### 3. **Security** ✅
- Admin authorization checks the database `profiles.role` column, not hardcoded values
- Frontend only uses `VITE_SUPABASE_ANON_KEY`, never `SUPABASE_SERVICE_ROLE_KEY`
- RLS policies protect against unauthorized access

---

## Database Setup Instructions

### Step 1: Run the Complete Schema

1. Go to your Supabase Project → SQL Editor
2. Create a new SQL query
3. Copy the contents of `supabase-schema.sql` from this project
4. Paste it into the Supabase SQL Editor
5. Click "Run"

This will create:
- `profiles` table with role-based access control
- `plant_submissions` table for pending/approved/rejected submissions
- `plants` table for approved public plants
- RLS policies for secure access
- RPC functions for atomic approval/rejection workflows
- Triggers for automatic points awards
- Storage bucket for plant images

### Step 2: Verify Tables Exist

In the Supabase Dashboard:
1. Go to the "Database" section
2. Expand the "public" schema
3. Verify these tables exist:
   - `profiles`
   - `plant_submissions`
   - `plants`
   - `auth.users` (Supabase built-in)

---

## Create an Admin Account

### Method 1: Supabase Dashboard (Fastest)

1. **Create an Auth User:**
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Email: `your-admin-email@example.com`
   - Password: `choose-a-secure-password`
   - Uncheck "Auto confirm user" (unless you want to skip email verification)
   - Click "Create User"

2. **Create the Admin Profile:**
   - Go to SQL Editor
   - Run this query:
   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE email = 'your-admin-email@example.com';
   ```
   - If the profile doesn't exist yet, create it:
   ```sql
   INSERT INTO profiles (id, name, email, role, points)
   SELECT id, 'Admin Name', email, 'admin', 0
   FROM auth.users
   WHERE email = 'your-admin-email@example.com'
   ON CONFLICT (id) DO UPDATE
   SET role = 'admin';
   ```

3. **Test Login:**
   - Go to http://localhost:8443/auth
   - Sign in with the admin email and password
   - Should redirect to `/admin` dashboard
   - Or use http://localhost:8443/admin-login for a dedicated admin login page

### Method 2: During User Registration

1. User signs up at `/auth` with any email/password
2. Their `profiles` row is automatically created with `role = 'user'`
3. Update their role in Supabase Dashboard:
   - Go to SQL Editor
   - Run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'their-email@example.com';
   ```
4. User logs out and logs back in
5. After login, redirects to `/admin`

---

## Environment Variables

### Local Development (.env file)

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-from-supabase-settings
```

To find these values:
1. Go to Supabase Dashboard → Settings → API
2. Copy the URL (Project URL)
3. Copy the Key under "anon public"

### Vercel Deployment

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these two variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Apply to: Production, Preview, Development
4. Redeploy your project

**IMPORTANT:** Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to Vercel or any frontend environment.

---

## Testing the Admin Dashboard

### Test 1: Normal User Login
1. Go to `/auth`
2. Sign up with email: `user@example.com`, password: `test123`
3. Should redirect to `/` (home page)
4. Should NOT be able to access `/admin`

### Test 2: Admin Login
1. Go to `/auth`
2. Sign in with admin email and password (created in previous steps)
3. Should redirect to `/admin` (admin dashboard)
4. Should see pending submissions, verified plants, rejected count, and contributors

### Test 3: Admin Access Control
1. As a normal user, try to manually visit `http://localhost:8443/admin`
2. Should redirect to `/`
3. Check browser console (F12) for any auth errors

### Test 4: Admin Dashboard Data
1. Log in as admin
2. Create a plant submission as a regular user (go to `/add`)
3. Go back to admin dashboard (should now see 1 pending)
4. Review the submission details
5. Click "Approve" or "Reject"
6. Stats should update in real-time

### Test 5: Verify Approval Workflow
1. After approving a submission:
   - The submission should move from `plant_submissions` (pending) to `plants` (approved)
   - Contributor should see it in `/contributions`
   - Public search and map should include the approved plant

### Test 6: Check Browser Console
1. Open DevTools (F12)
2. Go to the Console tab
3. Should NOT see any Supabase errors
4. If there are errors, they will show the exact error message, details, and code

---

## Troubleshooting

### Issue: "Unable to load submissions" Error

**Cause:** Supabase query failed

**Solution:**
1. Open Browser DevTools (F12)
2. Go to Console tab
3. Look for error messages starting with "Failed to fetch pending submissions"
4. The error will show the actual Supabase error
5. Common causes:
   - RLS policy not configured
   - User is not admin
   - Supabase URL/key is incorrect

### Issue: Login Works But Admin Dashboard Shows Zeros

**Cause:** Queries are working, but no data exists yet

**Solution:**
1. Create submissions as a regular user using `/add`
2. Admin dashboard will update in real-time

### Issue: "This account does not have administrator access" After Login

**Cause:** User's role is 'user', not 'admin'

**Solution:**
1. Go to Supabase SQL Editor
2. Run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   ```
3. User logs out and logs back in

### Issue: RLS Error When Approving Submissions

**Cause:** User is not admin, or RLS policy is not set correctly

**Solution:**
1. Verify the RLS policies are in place (Supabase Dashboard → Policies)
2. Verify the user's role is 'admin'
3. Check browser console for exact error message

### Issue: Redirects to `/` Instead of `/admin` After Login

**Cause:** Profile was not found or role is 'user'

**Solution:**
1. Ensure the profile exists:
   ```sql
   SELECT * FROM profiles WHERE email = 'your-email@example.com';
   ```
2. If profile doesn't exist, create it:
   ```sql
   INSERT INTO profiles (id, name, email, role, points)
   VALUES ('user-uuid-here', 'Your Name', 'your-email@example.com', 'admin', 0);
   ```

---

## Code Files Changed

### 1. `src/pages/AdminDashboard.tsx`
- ✅ Added detailed error logging in `fetchPending()`
- ✅ Added error logging in `fetchStats()`
- Errors now display the actual Supabase error message

### 2. `src/pages/Auth.tsx`
- ✅ Added `useEffect` to redirect logged-in users
- ✅ Modified `handleSubmit()` to check user role and redirect to `/admin` for admins
- ✅ Imported `useAuth` from context

### 3. `src/pages/AdminLogin.tsx`
- ✅ Removed hardcoded `ADMIN_EMAIL` and `ADMIN_USERNAME`
- ✅ Changed to accept email input instead of username
- ✅ Added detailed error logging
- ✅ Still validates `profile.role === 'admin'` from database

### 4. `src/lib/supabase.ts`
- No changes needed (already correct)

---

## Database Schema Overview

### `profiles` Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `plant_submissions` Table
```sql
CREATE TABLE plant_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_name TEXT NOT NULL,
  photo_url TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_accuracy DOUBLE PRECISION,
  location_source TEXT NOT NULL DEFAULT 'legacy',
  landmark TEXT,
  submitted_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `plants` Table
```sql
CREATE TABLE plants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plant_name TEXT NOT NULL,
  photo_url TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_accuracy DOUBLE PRECISION,
  location_source TEXT,
  landmark TEXT,
  submitted_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  source_submission_id UUID REFERENCES plant_submissions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## RLS (Row Level Security) Policies

These are automatically created by `supabase-schema.sql`, but you can verify them in:
Supabase Dashboard → Authentication → Policies

### Key Policies:
- ✅ `profiles_public_read` - Anyone can read profiles
- ✅ `submissions_read` - Users can read their own submissions; admins can read all
- ✅ `submissions_admin_update` - Only admins can update submissions
- ✅ `plants_public_read` - Anyone can read approved plants
- ✅ `plants_admin_insert` - Only admins can create approved plants directly (or via RPC)

---

## RPC Functions

These are provided by `supabase-schema.sql`:

### `approve_plant_submission()`
- Takes a submission ID
- Checks user is admin
- Atomically creates a plant and updates submission status
- Prevents double-approval

### `reject_plant_submission()`
- Takes a submission ID and optional reason
- Checks user is admin
- Updates submission status to 'rejected'
- Stores rejection reason

---

## Deployment Checklist

- [ ] Supabase project created
- [ ] Database schema applied (supabase-schema.sql)
- [ ] Admin user created with `role = 'admin'`
- [ ] Local `.env` file has correct VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- [ ] `npm run dev` works locally with no errors
- [ ] Can log in as admin and see dashboard
- [ ] Can log in as user and see home page
- [ ] Vercel project configured with environment variables
- [ ] Vercel deployment successful
- [ ] Production URL works with Supabase

---

## Questions?

If the admin dashboard still shows errors:
1. Check browser console (F12 → Console tab)
2. Look for "Failed to fetch pending submissions" or similar
3. The error will show the exact Supabase error
4. Common issues:
   - RLS policy blocking access
   - User is not admin
   - Invalid Supabase URL/key
   - Database not connected
