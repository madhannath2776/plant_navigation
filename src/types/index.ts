export type SubmissionStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";
export type LocationSource = "gps" | "map" | "admin_corrected" | "legacy";

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  points: number;
  created_at: string;
}

/** A public, approved plant. Every row in `plants` is public by
 * definition — there is no status field to check. */
export interface Plant {
  id: string;
  plant_name: string;
  photo_url?: string;
  latitude: number;
  longitude: number;
  location_accuracy?: number;
  location_source?: LocationSource;
  landmark?: string;
  submitted_by: string;
  approved_by?: string;
  approved_at?: string;
  source_submission_id?: string;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: Profile;
  distance?: number;
}

/** A user's submission — pending, approved, or rejected. Kept forever
 * as an audit trail even after being approved into `plants`. */
export interface PlantSubmission {
  id: string;
  plant_name: string;
  photo_url?: string;
  latitude: number;
  longitude: number;
  location_accuracy?: number;
  location_source: LocationSource;
  landmark?: string;
  submitted_by: string;
  status: SubmissionStatus;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: Profile;
}

/** A confirmed location, captured either via GPS or by dropping a pin
 * on the map — the two only ways a location can be set. Never typed. */
export type LocationData =
  | { source: "gps"; latitude: number; longitude: number; accuracy: number }
  | { source: "map"; latitude: number; longitude: number; accuracy: null }
  | { source: "admin_corrected"; latitude: number; longitude: number; accuracy: null };

export interface SearchResult {
  plant_name: string;
  match_count: number;
}

export interface AdminStatistics {
  pending: number;
  approved: number;
  rejected: number;
  totalPlants: number;
  contributors: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url?: string;
  points: number;
  verified_count: number;
}
