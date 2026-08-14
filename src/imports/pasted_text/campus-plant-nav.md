Build the complete frontend for **Campus Plant Navigation** using **React + Vite + TypeScript + Tailwind CSS**.

Connect it to the Supabase backend described below.

### Main idea

This is a fun, community-powered campus plant navigation application.

Students can:

**Discover → Upload → Get Verified → Earn Points → Appear on Leaderboard**

Anyone can:

**Search → Find nearest verified plant → Navigate to it**

---

# Main Pages

## 1. Home

Create a clean mobile-first homepage.

Show:

**Campus Plant Navigation**

> Discover and navigate to plants and trees around your campus.

Buttons:

* 🔎 Find a Plant
* 📷 Add a Plant
* 🗺️ Explore Map

Also show:

### 🏆 Top Contributors

Display the top 3 students from the leaderboard.

---

# 2. Find Plant

This is the main feature.

At the top:

**Search for a plant or tree**

Examples:

```text
Neem
Mango
Banyan
Tamarind
```

When the user searches:

1. Request/use current GPS location.
2. Get verified matching plants from Supabase.
3. Calculate distance from the user to every matching plant.
4. Sort by distance.
5. Display the nearest plant first.

Example:

```text
🌳 Neem

Nearest verified Neem

85 m away
Near Biotechnology Block

[View on Map]
[Navigate]
```

Show other matching plants underneath.

---

# 3. GPS

Use browser geolocation.

Show:

```text
📍 Location detected
```

Show the user's current position on the map.

Handle:

* Permission denied
* GPS unavailable
* Loading
* Browser does not support location

Do not store the user's live location permanently.

---

# 4. Interactive Map

Use:

* Leaflet
* React-Leaflet
* OpenStreetMap

Display:

🔵 User location

🌳 Verified plants

Highlight the nearest matching plant.

Clicking a plant marker should show:

* Common name
* Scientific name
* Distance
* Photo
* View Details
* Navigate

---

# 5. Plant Details

Display:

* Plant photograph
* Common name
* Scientific name
* Local name
* Plant type
* Description
* Campus zone
* Landmark
* Distance from user
* Map location

Button:

**🧭 Navigate**

Open Google Maps directions using the plant's latitude and longitude.

---

# 6. Add Plant

Create a simple contribution form.

Fields:

* Plant/tree photo
* Common name
* Scientific name (optional)
* Local name
* Plant type
* Description
* GPS location

Button:

**📍 Use My Current Location**

Automatically fill latitude and longitude.

Then:

**Submit Plant**

After submission show:

> 🌱 Submitted successfully!
>
> Your plant is waiting for verification.

The plant must NOT appear publicly until an admin verifies it.

---

# 7. My Contributions

Logged-in users can see:

* Plants they submitted
* Status
* Points earned
* Verification result

Example:

```text
Neem
🟢 Verified
+15 points

Mango
🟡 Pending

Banyan
🔴 Rejected
```

---

# 8. Leaderboard

Create a fun leaderboard page.

Show:

```text
🏆 Campus Plant Champions

🥇 Arun
32 verified plants
420 points

🥈 Priya
27 verified plants
350 points

🥉 Kavin
21 verified plants
280 points
```

Show the full ranking below.

Add badges:

* 🌱 Plant Starter — 5 verified plants
* 🌿 Green Explorer — 10
* 🌳 Plant Hunter — 25
* 🏆 Biodiversity Champion — 50

Only verified submissions count.

---

# 9. Admin Dashboard

Create an admin-only dashboard.

Show:

### Pending Submissions

Each card should show:

* Student name
* Photo
* Plant name
* Coordinates
* Map
* Date

Buttons:

**Approve**

**Reject**

**Edit**

When approving, the admin can correct:

* Plant name
* Scientific name
* Local name
* Coordinates
* Description

After approval:

* Plant becomes publicly visible
* Contributor receives points
* Leaderboard updates automatically

---

# 10. Navigation

For each verified plant create a dynamic Google Maps navigation link.

Use:

```text
https://www.google.com/maps/dir/?api=1&destination=LATITUDE,LONGITUDE
```

Do not hard-code coordinates.

---

# 11. Design

Make the interface:

* Modern
* Simple
* Mobile-first
* Green/nature themed
* Fun
* Student-friendly

Use cards, icons and clean typography.

The application should feel like a combination of:

**Google Maps + Plant Finder + Student Leaderboard**

but with a simple campus-focused design.

---

# 12. Important User Flow

The main workflow must be:

```text
Open App
   ↓
Allow Location
   ↓
Search "Neem"
   ↓
Supabase finds verified Neem trees
   ↓
Calculate distances
   ↓
Nearest Neem appears first
   ↓
Show on Map
   ↓
Navigate
```

Contribution workflow:

```text
Find Plant
   ↓
Take Photo
   ↓
Capture GPS
   ↓
Submit
   ↓
Admin Verification
   ↓
Approved
   ↓
Appears on Map
   ↓
Contributor Gets Points
   ↓
Leaderboard Updates
```

---

# 13. Supabase Connection

Use:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Create a clean Supabase client.

Do not expose the service-role key.

Use the database tables, authentication, storage and RLS from the backend implementation.

---

# 14. Required Frontend Deliverables

Generate the complete working project:

* React
* Vite
* TypeScript
* Tailwind CSS
* React Router
* Supabase client
* Leaflet
* React-Leaflet
* GPS hook
* Search functionality
* Distance calculation
* Map
* Plant details
* Plant submission
* Image upload
* Authentication
* User contributions
* Leaderboard
* Badges
* Admin dashboard
* Verification
* Navigation
* Responsive mobile design
* Error handling
* Loading states
* Empty states
* `.env.example`
* README

Do not provide pseudo-code.

Generate actual working code.

Make sure all imports, routes, Supabase queries, TypeScript types and components are connected correctly.

The final project should run with:

```bash
npm install
npm run dev
```

and work correctly on a mobile phone over HTTPS.
