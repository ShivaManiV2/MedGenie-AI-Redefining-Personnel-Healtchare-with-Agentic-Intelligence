
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Onboarding from './pages/Onboarding';
import Profile from './pages/Profile';
import Tools from './pages/Tools';
import SymptomTriage from './pages/SymptomTriage';
import CarePathwayPage from './pages/CarePathway';
import DrugInteraction from './pages/DrugInteraction';
import ClinicFinder from './pages/ClinicFinder';
import LabReportParser from './pages/LabReportParser';
import MedicalSearch from './pages/MedicalSearch';
import HealthProgress from './pages/HealthProgress';
import PatientTwin from './pages/PatientTwin';
import { UserProfile } from './types';

const INITIAL_PROFILE: UserProfile = {
  name: '',
  age: 0,
  gender: 'Other',
  weight: 0,
  height: 0,
  bloodGroup: 'Unknown',
  allergies: [],
  medicalHistory: '',
  healthSummary: '',
  isRegistered: false,
};

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('medi_profile');
    return saved ? JSON.parse(saved) : INITIAL_PROFILE;
  });

  useEffect(() => {
    localStorage.setItem('medi_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const handleRegister = (profile: UserProfile) => {
    setUserProfile({ ...profile, isRegistered: true });
  };

  if (!userProfile.isRegistered) {
    return <Onboarding onComplete={handleRegister} />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header profile={userProfile} />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <Routes>
              <Route path="/" element={<Dashboard profile={userProfile} />} />
              <Route path="/chat" element={<Chat profile={userProfile} />} />
              <Route path="/tools" element={<Tools profile={userProfile} />} />
              <Route path="/triage" element={<SymptomTriage profile={userProfile} />} />
              <Route path="/pathway" element={<CarePathwayPage profile={userProfile} />} />
              <Route path="/drugs" element={<DrugInteraction />} />
              <Route path="/clinics" element={<ClinicFinder />} />
              <Route path="/lab-parser" element={<LabReportParser />} />
              <Route path="/med-search" element={<MedicalSearch />} />
              <Route path="/progress" element={<HealthProgress profile={userProfile} setProfile={setUserProfile} />} />
              <Route path="/twin" element={<PatientTwin profile={userProfile} setProfile={setUserProfile} />} />
              <Route path="/profile" element={<Profile profile={userProfile} setProfile={setUserProfile} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;
