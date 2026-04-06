import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Plus, ArrowRight, User, Shield, Loader2 } from 'lucide-react';

type Event = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: 'planned' | 'active' | 'completed';
};

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const navigate = useNavigate();

  const [suggestions, setSuggestions] = useState<{title: string, uri: string}[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userCoords, setUserCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.warn("Geolocation error:", err)
      );
    }
    
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (location.length < 3 || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const apiKey = (import.meta as any).env.VITE_YANDEX_API_KEY;
        if (!apiKey) {
          console.warn("Yandex API key is missing. Please set VITE_YANDEX_API_KEY in .env");
          setSuggestions([]);
          return;
        }
        
        let url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&format=json&geocode=${encodeURIComponent(location)}`;
        if (userCoords) {
          // Add location bias based on user coordinates
          url += `&ll=${userCoords.longitude},${userCoords.latitude}&spn=0.5,0.5`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        const places = data.response?.GeoObjectCollection?.featureMember?.map((member: any) => {
          const obj = member.GeoObject;
          return { 
            title: obj.description ? `${obj.name}, ${obj.description}` : obj.name, 
            uri: '' 
          };
        }) || [];
          
        const uniquePlaces = Array.from(new Map(places.map((p: any) => [p.title, p])).values()) as {title: string, uri: string}[];
        setSuggestions(uniquePlaces);
      } catch (e) {
        console.error("Error fetching location suggestions:", e);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 800);
    
    return () => clearTimeout(timer);
  }, [location, userCoords, showSuggestions]);

  const handleSelectSuggestion = (title: string) => {
    setLocation(title);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => setEvents(data));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, date, location })
    });
    const newEvent = await res.json();
    navigate(`/organizer/${newEvent.id}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-4">EventFlow</h1>
        <p className="text-lg text-slate-600">Real-time event management & scheduling</p>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Create Event
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Tech Conference 2026"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input 
                  type="date" 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
              <div className="relative" ref={wrapperRef}>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={location}
                  onChange={e => {
                    setLocation(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="e.g. Main Hall or search nearby..."
                />
                {showSuggestions && (location.length >= 3) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {isSearchingLocation ? (
                      <div className="p-3 text-sm text-slate-500 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Searching nearby...
                      </div>
                    ) : suggestions.length > 0 ? (
                      <ul className="max-h-60 overflow-auto">
                        {suggestions.map((s, i) => (
                          <li 
                            key={i}
                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b last:border-0 border-slate-100"
                            onClick={() => handleSelectSuggestion(s.title)}
                          >
                            <div className="font-medium text-slate-900">{s.title}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-3 text-sm text-slate-500 text-center">No places found</div>
                    )}
                  </div>
                )}
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
              >
                Create Event
              </button>
            </form>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold mb-6">Existing Events</h2>
          {events.length === 0 ? (
            <div className="text-center py-12 bg-slate-100 rounded-2xl border border-slate-200 border-dashed">
              <p className="text-slate-500">No events found. Create one to get started.</p>
            </div>
          ) : (
            events.map(event => (
              <div key={event.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-300 transition-colors">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{event.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {event.date}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link 
                    to={`/organizer/${event.id}`}
                    className="flex items-center gap-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Manage
                  </Link>
                  <Link 
                    to={`/event/${event.id}`}
                    className="flex items-center gap-1 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Join
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
