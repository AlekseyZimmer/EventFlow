import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import OrganizerView from './pages/OrganizerView';
import ParticipantView from './pages/ParticipantView';
import { LanguageProvider, useLanguage } from './lib/i18n';

function TopBar() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex justify-end p-4 gap-4 bg-white border-b border-slate-200">
      <div className="flex bg-slate-100 rounded-lg p-1">
        <button 
          onClick={() => setLang('en')} 
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${lang === 'en' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          EN
        </button>
        <button 
          onClick={() => setLang('ru')} 
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${lang === 'ru' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          RU
        </button>
        <button 
          onClick={() => setLang('emj')} 
          className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${lang === 'emj' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
        >
          EMJ
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
          <TopBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/organizer/:eventId" element={<OrganizerView />} />
            <Route path="/event/:eventId" element={<ParticipantView />} />
          </Routes>
        </div>
      </Router>
    </LanguageProvider>
  );
}
