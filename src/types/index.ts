export type PlantStatus = "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  points: number;
  created_at: string;
}

export interface Plant {
  id: string;
  plant_name: string;
  latitude: number;
  longitude: number;
  landmark?: string;
  photo_url?: string;
  submitted_by: string;
  status: PlantStatus;
  verified_by?: string;
  verified_at?: string;
  points_awarded?: number;
  created_at: string;
  updated_at: string;
  // joined
  profiles?: Profile;
  distance?: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url?: string;
  points: number;
  verified_count: number;
}
