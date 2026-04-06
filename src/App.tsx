import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import OrganizerView from './pages/OrganizerView';
import ParticipantView from './pages/ParticipantView';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/organizer/:eventId" element={<OrganizerView />} />
          <Route path="/event/:eventId" element={<ParticipantView />} />
        </Routes>
      </div>
    </Router>
  );
}
