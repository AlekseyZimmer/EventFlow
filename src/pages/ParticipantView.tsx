import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Clock, AlertCircle, ArrowLeft, Calendar, MapPin } from 'lucide-react';
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

export default function ParticipantView() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;

    fetch(`/api/events/${eventId}`).then(res => res.json()).then(setEvent);
    fetch(`/api/events/${eventId}/stages`).then(res => res.json()).then(setStages);

    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join_event', eventId);

    newSocket.on('schedule_updated', () => {
      fetch(`/api/events/${eventId}/stages`).then(res => res.json()).then(setStages);
    });

    newSocket.on('event_updated', (updatedEvent: Event) => {
      setEvent(updatedEvent);
    });

    newSocket.on('stage_updated', (stage: Stage) => {
      if (stage.status === 'active') {
        showNotification(`"${stage.name}" has just started!`);
      } else if (stage.status === 'completed') {
        showNotification(`"${stage.name}" is now completed.`);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [eventId]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  if (!event) return <div className="p-8 text-center">Loading...</div>;

  const activeStage = stages.find(s => s.status === 'active');

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-medium animate-in slide-in-from-top-4 fade-in duration-300">
          {notification}
        </div>
      )}

      <div className="mb-8 text-center">
        <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">{event.name}</h1>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {event.date}</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.location}</span>
        </div>
      </div>

      {activeStage && (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wide uppercase mb-4">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
              Happening Now
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{activeStage.name}</h2>
            <p className="text-blue-100 mb-6 max-w-xl">{activeStage.description}</p>
            <div className="flex items-center gap-4 text-sm font-medium text-blue-50">
              <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg">
                <Clock className="w-4 h-4" />
                Started {activeStage.actualStartTime ? format(parseISO(activeStage.actualStartTime), 'HH:mm') : '--:--'}
              </div>
              {activeStage.responsiblePerson && (
                <div className="bg-black/20 px-3 py-1.5 rounded-lg">
                  {activeStage.responsiblePerson}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {stages.map((stage, index) => {
          const isPast = stage.status === 'completed';
          const isActive = stage.status === 'active';
          
          let delayMinutes = 0;
          if (stage.actualStartTime) {
            delayMinutes = differenceInMinutes(parseISO(stage.actualStartTime), parseISO(stage.plannedStartTime));
          }

          return (
            <div key={stage.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              {/* Timeline dot */}
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10",
                isActive ? "bg-blue-500" : isPast ? "bg-slate-300" : "bg-white border-slate-200"
              )}>
                {isActive && <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>}
              </div>

              {/* Card */}
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-white shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h3 className={cn("font-semibold", isActive ? "text-blue-600" : isPast ? "text-slate-500" : "text-slate-900")}>
                    {stage.name}
                  </h3>
                  <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {format(parseISO(stage.plannedStartTime), 'HH:mm')}
                  </div>
                </div>
                
                {delayMinutes > 0 && (
                  <div className="flex items-center gap-1 text-xs font-medium text-amber-600 mb-2 bg-amber-50 inline-flex px-2 py-1 rounded">
                    <AlertCircle className="w-3 h-3" />
                    Running {delayMinutes}m late
                  </div>
                )}
                
                {stage.description && (
                  <p className="text-sm text-slate-600 line-clamp-2">{stage.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
