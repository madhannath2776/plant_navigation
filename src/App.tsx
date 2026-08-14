import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import ConfigWarningBanner from "@/components/ConfigWarningBanner";
import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import FindPlant from "@/pages/FindPlant";
import PlantDetail from "@/pages/PlantDetail";
import AddPlant from "@/pages/AddPlant";
import MyContributions from "@/pages/MyContributions";
import Leaderboard from "@/pages/Leaderboard";
import MapExplore from "@/pages/MapExplore";
import AdminDashboard from "@/pages/AdminDashboard";

export default function App() {
  return (
    <AuthProvider>
      <ConfigWarningBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="*"
            element={
              <>
                <Navbar />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/find" element={<FindPlant />} />
                  <Route path="/plant/:id" element={<PlantDetail />} />
                  <Route path="/add" element={<AddPlant />} />
                  <Route path="/contributions" element={<MyContributions />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/map" element={<MapExplore />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                </Routes>
              </>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
