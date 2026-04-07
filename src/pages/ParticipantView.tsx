import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Clock, AlertCircle, ArrowLeft, Calendar, MapPin, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/i18n';

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
  const { t } = useLanguage();
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

  if (!event) return <div className="p-8 text-center">{t('loading')}</div>;

  const activeStage = stages.find(s => s.status === 'active');
  const pastStages = stages.filter(s => s.status === 'completed');
  const upcomingStages = stages.filter(s => s.status !== 'completed');

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-medium animate-in slide-in-from-top-4 fade-in duration-300">
          {notification}
        </div>
      )}

      <div className="mb-8 text-center">
        <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('backToEvents')}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">{event.name}</h1>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {event.date}</span>
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {event.location}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          {activeStage ? (
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold tracking-wide uppercase mb-4">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                  {t('nowHappening')}
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">{activeStage.name}</h2>
                <p className="text-blue-100 mb-6 max-w-xl">{activeStage.description}</p>
                <div className="flex items-center gap-4 text-sm font-medium text-blue-50">
                  <div className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-lg">
                    <Clock className="w-4 h-4" />
                    {t('startedAt')} {activeStage.actualStartTime ? format(parseISO(activeStage.actualStartTime), 'HH:mm') : '--:--'}
                  </div>
                  {activeStage.responsiblePerson && (
                    <div className="bg-black/20 px-3 py-1.5 rounded-lg">
                      {activeStage.responsiblePerson}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 rounded-2xl p-6 sm:p-8 text-slate-500 flex items-center justify-center h-full border border-slate-200 border-dashed">
              <p>{t('noActiveStage')}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-slate-900 rounded-2xl p-6 text-white h-full">
            <h3 className="text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">{t('currentStatus')}</h3>
            
            {activeStage ? (
              <div>
                <div className="text-xs text-blue-400 font-medium mb-1">{t('nowHappening')}</div>
                <div className="text-2xl font-bold mb-2">{activeStage.name}</div>
                <div className="text-slate-300 text-sm mb-6">
                  {t('startedAt')} {activeStage.actualStartTime ? format(parseISO(activeStage.actualStartTime), 'HH:mm') : '--:--'}
                </div>
                
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
                  <div className="h-full bg-blue-500 w-1/2 animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 mb-6 italic">{t('noActiveStage')}</div>
            )}

            <div className="pt-6 border-t border-slate-800">
              <h4 className="text-sm font-medium text-slate-400 mb-3">{t('upNext')}</h4>
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

      <div className="grid md:grid-cols-2 gap-12">
        {/* Left Column: Past Stages */}
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-slate-400" />
            {t('completedStages')}
          </h3>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
            {pastStages.length === 0 && (
              <p className="text-slate-500 italic ml-12">{t('noCompleted')}</p>
            )}
            {pastStages.map((stage) => (
              <div key={stage.id} className="relative flex items-start gap-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-slate-300 shrink-0 shadow-sm z-10"></div>
                <div className="flex-1 p-4 rounded-xl border bg-slate-50/50 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-slate-500 line-through">{stage.name}</h4>
                    <div className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded">
                      {format(parseISO(stage.plannedStartTime), 'HH:mm')}
                    </div>
                  </div>
                  {stage.description && <p className="text-sm text-slate-400 line-clamp-1">{stage.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Current & Upcoming Stages */}
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            {t('currentUpcoming')}
          </h3>
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-200 before:to-slate-200">
            {upcomingStages.length === 0 && (
              <p className="text-slate-500 italic ml-12">{t('noUpcoming')}</p>
            )}
            {upcomingStages.map((stage) => {
              const isActive = stage.status === 'active';
              let delayMinutes = 0;
              if (stage.actualStartTime) {
                delayMinutes = differenceInMinutes(parseISO(stage.actualStartTime), parseISO(stage.plannedStartTime));
              }

              return (
                <div key={stage.id} className="relative flex items-start gap-6">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 shrink-0 shadow-sm z-10",
                    isActive ? "bg-blue-500" : "bg-white border-slate-200"
                  )}>
                    {isActive && <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>}
                  </div>
                  
                  <div className={cn(
                    "flex-1 p-4 rounded-xl border shadow-sm transition-all",
                    isActive ? "bg-white border-blue-300 ring-1 ring-blue-300" : "bg-white border-slate-200"
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={cn("font-semibold", isActive ? "text-blue-600" : "text-slate-900")}>
                        {stage.name}
                      </h4>
                      <div className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {format(parseISO(stage.plannedStartTime), 'HH:mm')}
                      </div>
                    </div>
                    
                    {delayMinutes > 0 && (
                      <div className="flex items-center gap-1 text-xs font-medium text-amber-600 mb-2 bg-amber-50 inline-flex px-2 py-1 rounded">
                        <AlertCircle className="w-3 h-3" />
                        {t('runningLate')} {delayMinutes}m
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
      </div>
    </div>
  );
}
