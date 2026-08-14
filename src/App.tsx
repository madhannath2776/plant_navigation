import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import ConfigWarningBanner from "@/components/ConfigWarningBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import FindPlant from "@/pages/FindPlant";
import PlantDetail from "@/pages/PlantDetail";
import AddPlant from "@/pages/AddPlant";
import MyContributions from "@/pages/MyContributions";
import Leaderboard from "@/pages/Leaderboard";
import MapExplore from "@/pages/MapExplore";
import AdminDashboard from "@/pages/AdminDashboard";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0faf5] px-4 pt-16">
      <div className="text-center">
        <p className="text-5xl mb-3">🍃</p>
        <p className="font-display font-semibold text-[#1a4731] text-xl">Page not found</p>
        <a href="/" className="text-[#52b788] underline mt-2 inline-block">Back to Home</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
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
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
