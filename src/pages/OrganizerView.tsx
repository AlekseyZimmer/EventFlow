import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { Clock, Play, CheckCircle, Plus, AlertCircle, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';

type Event = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: 'planned' | 'active' | 'completed';
};

type Stage = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  plannedStartTime: string;
  plannedEndTime: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  status: 'pending' | 'active' | 'completed';
  responsiblePerson: string;
  order: number;
};

export default function OrganizerView() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // New stage form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newPerson, setNewPerson] = useState('');

  useEffect(() => {
    if (!eventId) return;

    // Fetch initial data
    fetch(`/api/events/${eventId}`).then(res => res.json()).then(setEvent);
    fetch(`/api/events/${eventId}/stages`).then(res => res.json()).then(setStages);

    // Setup Socket.IO
    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join_event', eventId);

    newSocket.on('schedule_updated', () => {
      fetch(`/api/events/${eventId}/stages`).then(res => res.json()).then(setStages);
    });

    newSocket.on('event_updated', (updatedEvent: Event) => {
      setEvent(updatedEvent);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [eventId]);

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    // Convert local time to ISO for simple storage
    const today = new Date().toISOString().split('T')[0];
    const startIso = new Date(`${today}T${newStart}`).toISOString();
    const endIso = new Date(`${today}T${newEnd}`).toISOString();

    await fetch(`/api/events/${eventId}/stages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        description: newDesc,
        plannedStartTime: startIso,
        plannedEndTime: endIso,
        responsiblePerson: newPerson
      })
    });

    setIsAdding(false);
    setNewName(''); setNewDesc(''); setNewStart(''); setNewEnd(''); setNewPerson('');
  };

  const updateStageStatus = async (stageId: string, status: 'active' | 'completed') => {
    await fetch(`/api/stages/${stageId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, time: new Date().toISOString() })
    });
  };

  if (!event) return <div className="p-8 text-center">Loading...</div>;

  const activeStage = stages.find(s => s.status === 'active');
  
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Events
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{event.name}</h1>
            <p className="text-slate-500 mt-1">Organizer Dashboard • {event.location}</p>
          </div>
          <div className={cn(
            "px-4 py-2 rounded-full text-sm font-medium",
            event.status === 'active' ? "bg-green-100 text-green-700" : 
            event.status === 'completed' ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-700"
          )}>
            {event.status.toUpperCase()}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Schedule</h2>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus className="w-4 h-4" /> Add Stage
            </button>
          </div>

          {isAdding && (
            <form onSubmit={handleAddStage} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Stage Name</label>
                  <input type="text" required className="w-full px-3 py-2 border rounded-lg" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Time</label>
                  <input type="time" required className="w-full px-3 py-2 border rounded-lg" value={newStart} onChange={e => setNewStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Time</label>
                  <input type="time" required className="w-full px-3 py-2 border rounded-lg" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Responsible Person</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg" value={newPerson} onChange={e => setNewPerson(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Save Stage</button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {stages.map((stage, index) => {
              const isPast = stage.status === 'completed';
              const isActive = stage.status === 'active';
              
              let delayMinutes = 0;
              if (stage.actualStartTime) {
                delayMinutes = differenceInMinutes(parseISO(stage.actualStartTime), parseISO(stage.plannedStartTime));
              }

              return (
                <div key={stage.id} className={cn(
                  "p-5 rounded-xl border transition-all",
                  isActive ? "bg-white border-blue-400 shadow-md ring-1 ring-blue-400" :
                  isPast ? "bg-slate-50 border-slate-200 opacity-75" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={cn("text-lg font-semibold", isActive ? "text-blue-900" : "text-slate-900")}>
                          {stage.name}
                        </h3>
                        {isActive && <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 animate-pulse">LIVE</span>}
                        {isPast && <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600">DONE</span>}
                      </div>
                      <p className="text-sm text-slate-500 mb-3">{stage.description}</p>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Clock className="w-4 h-4" />
                          <span>{format(parseISO(stage.plannedStartTime), 'HH:mm')} - {format(parseISO(stage.plannedEndTime), 'HH:mm')}</span>
                        </div>
                        {delayMinutes > 0 && (
                          <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            <span>{delayMinutes}m delay</span>
                          </div>
                        )}
                        {stage.responsiblePerson && (
                          <div className="text-slate-500">Resp: {stage.responsiblePerson}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {stage.status === 'pending' && (
                        <button 
                          onClick={() => updateStageStatus(stage.id, 'active')}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Play className="w-4 h-4" /> Start
                        </button>
                      )}
                      {stage.status === 'active' && (
                        <button 
                          onClick={() => updateStageStatus(stage.id, 'completed')}
                          className="flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
                        >
                          <CheckCircle className="w-4 h-4" /> Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {stages.length === 0 && !isAdding && (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
                <p className="text-slate-500">No stages added yet. Build your schedule.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-slate-900 rounded-2xl p-6 text-white sticky top-6">
            <h3 className="text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">Current Status</h3>
            
            {activeStage ? (
              <div>
                <div className="text-xs text-blue-400 font-medium mb-1">NOW HAPPENING</div>
                <div className="text-2xl font-bold mb-2">{activeStage.name}</div>
                <div className="text-slate-300 text-sm mb-6">
                  Started at {activeStage.actualStartTime ? format(parseISO(activeStage.actualStartTime), 'HH:mm') : '--:--'}
                </div>
                
                {/* Progress bar simulation */}
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-blue-500 w-1/2 animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 mb-6 italic">No active stage</div>
            )}

            <div className="pt-6 border-t border-slate-800">
              <h4 className="text-sm font-medium text-slate-400 mb-3">Up Next</h4>
              {stages.filter(s => s.status === 'pending').slice(0, 2).map(s => (
                <div key={s.id} className="mb-3 last:mb-0">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-slate-500">{format(parseISO(s.plannedStartTime), 'HH:mm')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
