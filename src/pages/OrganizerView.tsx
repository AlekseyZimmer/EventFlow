import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { Clock, Play, CheckCircle, Plus, AlertCircle, ArrowLeft, Upload, Download, GripVertical, Copy, Check } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import * as XLSX from 'xlsx';
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

export default function OrganizerView() {
  const { t } = useLanguage();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [ownerToken, setOwnerToken] = useState('');
  const [copied, setCopied] = useState(false);

  // New stage form state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newPerson, setNewPerson] = useState('');

  useEffect(() => {
    if (!eventId) return;

    const tokens = JSON.parse(localStorage.getItem('event_owners') || '{}');
    const token = tokens[eventId];
    
    if (!token) {
      setIsOwner(false);
      return;
    }
    setOwnerToken(token);

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

  if (!isOwner) {
    return (
      <div className="max-w-xl mx-auto mt-20 p-8 bg-white rounded-2xl shadow-sm border border-slate-200 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('accessDenied')}</h2>
        <p className="text-slate-600 mb-6">
          {t('accessDeniedDesc')}
        </p>
        <Link to={`/event/${eventId}`} className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
          {t('goToParticipant')}
        </Link>
      </div>
    );
  }

  const handleOpenAddStage = () => {
    if (stages.length > 0) {
      const lastStage = stages[stages.length - 1];
      const endTime = format(parseISO(lastStage.plannedEndTime), 'HH:mm');
      setNewStart(endTime);
      const endIso = addMinutes(parseISO(lastStage.plannedEndTime), 30);
      setNewEnd(format(endIso, 'HH:mm'));
    } else {
      setNewStart('');
      setNewEnd('');
    }
    setIsAdding(true);
  };

  const handleCopyCode = () => {
    if (eventId) {
      navigator.clipboard.writeText(eventId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    const today = event?.date || new Date().toISOString().split('T')[0];
    const startIso = new Date(`${today}T${newStart}`).toISOString();
    const endIso = new Date(`${today}T${newEnd}`).toISOString();

    await fetch(`/api/events/${eventId}/stages`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-owner-token': ownerToken
      },
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
      headers: { 
        'Content-Type': 'application/json',
        'x-owner-token': ownerToken
      },
      body: JSON.stringify({ status, time: new Date().toISOString() })
    });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Name: 'Registration', Description: 'Guest check-in', 'Start Time (HH:mm)': '09:00', 'End Time (HH:mm)': '10:00', Responsible: 'Alice' },
      { Name: 'Opening Speech', Description: 'Welcome note', 'Start Time (HH:mm)': '10:00', 'End Time (HH:mm)': '10:30', Responsible: 'Bob' }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stages');
    XLSX.writeFile(wb, 'EventFlow_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const today = event?.date || new Date().toISOString().split('T')[0];
      
      const formattedStages = data.map((row: any) => ({
        name: row['Name'] || 'Unnamed Stage',
        description: row['Description'] || '',
        plannedStartTime: new Date(`${today}T${row['Start Time (HH:mm)'] || '00:00'}`).toISOString(),
        plannedEndTime: new Date(`${today}T${row['End Time (HH:mm)'] || '01:00'}`).toISOString(),
        responsiblePerson: row['Responsible'] || ''
      }));

      await fetch(`/api/events/${eventId}/stages/bulk`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-owner-token': ownerToken
        },
        body: JSON.stringify({ stages: formattedStages })
      });
      
      // Reset input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Optimistic update
    setStages(items);

    await fetch(`/api/events/${eventId}/stages/reorder`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'x-owner-token': ownerToken
      },
      body: JSON.stringify({ stageIds: items.map((i: any) => i.id) })
    });
  };

  if (!event) return <div className="p-8 text-center">{t('loading')}</div>;

  const activeStage = stages.find(s => s.status === 'active');
  
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-8">
        <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> {t('backToEvents')}
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{event.name}</h1>
            <p className="text-slate-500 mt-1">{t('orgDashboard')} • {event.location}</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              title={t('copyCode')}
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? t('codeCopied') : t('eventCode')}
            </button>
            <Link 
              to={`/event/${eventId}`}
              className="px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
            >
              {t('viewAsParticipant')}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">{t('schedule')}</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> {t('template')}
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                <Upload className="w-4 h-4" /> {t('importExcel')}
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
              </label>
              <button 
                onClick={handleOpenAddStage}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> {t('addStage')}
              </button>
            </div>
          </div>

          {isAdding && (
            <form onSubmit={handleAddStage} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('stageName')}</label>
                  <input type="text" required className="w-full px-3 py-2 border rounded-lg" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('startTime')}</label>
                  <input type="time" required className="w-full px-3 py-2 border rounded-lg" value={newStart} onChange={e => setNewStart(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('endTime')}</label>
                  <input type="time" required className="w-full px-3 py-2 border rounded-lg" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('responsible')}</label>
                  <input type="text" className="w-full px-3 py-2 border rounded-lg" value={newPerson} onChange={e => setNewPerson(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-slate-600">{t('cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">{t('saveStage')}</button>
              </div>
            </form>
          )}

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="stages">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {stages.map((stage, index) => {
                    const isPast = stage.status === 'completed';
                    const isActive = stage.status === 'active';
                    
                    let delayMinutes = 0;
                    if (stage.actualStartTime) {
                      delayMinutes = differenceInMinutes(parseISO(stage.actualStartTime), parseISO(stage.plannedStartTime));
                    }

                    return (
                      <Draggable draggableId={stage.id} index={index}>
                        {(provided) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "p-5 rounded-xl border transition-all flex items-stretch gap-3",
                              isActive ? "bg-white border-blue-400 shadow-md ring-1 ring-blue-400" :
                              isPast ? "bg-slate-50 border-slate-200 opacity-75" : "bg-white border-slate-200"
                            )}
                          >
                            <div 
                              {...provided.dragHandleProps}
                              className="flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="w-5 h-5" />
                            </div>
                            <div className="flex-1 flex items-start justify-between">
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
                                      <span>{delayMinutes}m {t('delay')}</span>
                                    </div>
                                  )}
                                  {stage.responsiblePerson && (
                                    <div className="text-slate-500">{stage.responsiblePerson}</div>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                {stage.status === 'pending' && (
                                  <button 
                                    onClick={() => updateStageStatus(stage.id, 'active')}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                                  >
                                    <Play className="w-4 h-4" /> {t('start')}
                                  </button>
                                )}
                                {stage.status === 'active' && (
                                  <button 
                                    onClick={() => updateStageStatus(stage.id, 'completed')}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                  >
                                    <CheckCircle className="w-4 h-4" /> {t('complete')}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          
          {stages.length === 0 && !isAdding && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
              <p className="text-slate-500">No stages added yet. Build your schedule or import from Excel.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-slate-900 rounded-2xl p-6 text-white sticky top-6">
            <h3 className="text-slate-400 text-sm font-medium mb-4 uppercase tracking-wider">{t('currentStatus')}</h3>
            
            {activeStage ? (
              <div>
                <div className="text-xs text-blue-400 font-medium mb-1">{t('nowHappening')}</div>
                <div className="text-2xl font-bold mb-2">{activeStage.name}</div>
                <div className="text-slate-300 text-sm mb-6">
                  {t('startedAt')} {activeStage.actualStartTime ? format(parseISO(activeStage.actualStartTime), 'HH:mm') : '--:--'}
                </div>
                
                {/* Progress bar simulation */}
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
    </div>
  );
}
