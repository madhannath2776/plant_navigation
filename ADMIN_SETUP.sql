-- ============================================================
-- CAMPUSFLORA ADMIN ACCOUNT SETUP
-- Run this AFTER the main schema (supabase-schema.sql) is applied
-- ============================================================

-- ============================================================
-- IMPORTANT: These commands must be run in the correct order:
-- 1. Create the user in Supabase Auth (UI or API)
-- 2. Run this SQL in the Supabase SQL Editor
-- ============================================================

-- Step 1: If you manually created an auth user, link it to a profile with admin role
-- Replace 'your-email@example.com' with the actual email you used
UPDATE profiles
SET role = 'admin'
WHERE email = 'madhannaths2776@gmail.com.com'
AND role != 'admin';

-- Step 2: Verify the admin was created
-- This query shows all admin users
SELECT id, name, email, role, points, created_at
FROM profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- Step 3: Optional - Create a specific admin account by UUID
-- (Only if you know the UUID from auth.users table)
-- Replace 'actual-uuid-from-auth-users' with the real UUID
--
-- UPDATE profiles
-- SET role = 'admin'
-- WHERE id = 'actual-uuid-from-auth-users'::uuid;

-- ============================================================
-- If you need to manually insert an admin profile after auth user is created:
-- ============================================================
--
-- INSERT INTO profiles (id, name, email, role, points)
-- SELECT 
--   auth_users.id,
--   'Admin Name',
--   auth_users.email,
--   'admin',
--   0
-- FROM auth.users auth_users
-- WHERE auth_users.email = 'your-email@example.com'
-- ON CONFLICT (id) DO UPDATE
-- SET role = 'admin';

-- ============================================================
-- Demote an admin back to regular user (if needed)
-- ============================================================
--
-- UPDATE profiles
-- SET role = 'user'
-- WHERE email = 'admin-email@example.com';

-- ============================================================
-- List all users and their roles (for verification)
-- ============================================================
--
-- SELECT 
--   p.id,
--   p.name,
--   p.email,
--   p.role,
--   p.points,
--   COUNT(ps.id) as submissions_made,
--   COUNT(pl.id) as plants_approved,
--   p.created_at
-- FROM profiles p
-- LEFT JOIN plant_submissions ps ON ps.submitted_by = p.id
-- LEFT JOIN plants pl ON pl.submitted_by = p.id
-- GROUP BY p.id
-- ORDER BY p.created_at DESC;
