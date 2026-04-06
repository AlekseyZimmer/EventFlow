import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// --- In-Memory Database ---
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

let events: Event[] = [];
let stages: Stage[] = [];

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  // Get all events
  app.get('/api/events', (req, res) => {
    res.json(events);
  });

  // Create an event
  app.post('/api/events', (req, res) => {
    const { name, date, location } = req.body;
    const newEvent: Event = {
      id: uuidv4(),
      name,
      date,
      location,
      status: 'planned'
    };
    events.push(newEvent);
    res.status(201).json(newEvent);
  });

  // Get single event
  app.get('/api/events/:id', (req, res) => {
    const event = events.find(e => e.id === req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  });

  // Get stages for an event
  app.get('/api/events/:id/stages', (req, res) => {
    const eventStages = stages
      .filter(s => s.eventId === req.params.id)
      .sort((a, b) => a.order - b.order);
    res.json(eventStages);
  });

  // Create a stage
  app.post('/api/events/:id/stages', (req, res) => {
    const { name, description, plannedStartTime, plannedEndTime, responsiblePerson } = req.body;
    const eventId = req.params.id;
    
    const eventStages = stages.filter(s => s.eventId === eventId);
    const order = eventStages.length;

    const newStage: Stage = {
      id: uuidv4(),
      eventId,
      name,
      description,
      plannedStartTime,
      plannedEndTime,
      actualStartTime: null,
      actualEndTime: null,
      status: 'pending',
      responsiblePerson,
      order
    };
    stages.push(newStage);
    
    io.to(eventId).emit('schedule_updated');
    res.status(201).json(newStage);
  });

  // Update stage status (Start/Complete)
  app.patch('/api/stages/:id/status', (req, res) => {
    const { status, time } = req.body;
    const stageIndex = stages.findIndex(s => s.id === req.params.id);
    
    if (stageIndex === -1) return res.status(404).json({ error: 'Stage not found' });
    
    const stage = stages[stageIndex];
    stage.status = status;
    
    if (status === 'active') {
      stage.actualStartTime = time;
      // Also update event status if it's the first stage
      const event = events.find(e => e.id === stage.eventId);
      if (event && event.status === 'planned') {
        event.status = 'active';
        io.to(event.id).emit('event_updated', event);
      }
    } else if (status === 'completed') {
      stage.actualEndTime = time;
    }

    io.to(stage.eventId).emit('stage_updated', stage);
    io.to(stage.eventId).emit('schedule_updated');
    res.json(stage);
  });

  // Update stage timing (Adjust schedule)
  app.patch('/api/stages/:id/timing', (req, res) => {
    const { plannedStartTime, plannedEndTime } = req.body;
    const stage = stages.find(s => s.id === req.params.id);
    
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    
    if (plannedStartTime) stage.plannedStartTime = plannedStartTime;
    if (plannedEndTime) stage.plannedEndTime = plannedEndTime;

    io.to(stage.eventId).emit('stage_updated', stage);
    io.to(stage.eventId).emit('schedule_updated');
    res.json(stage);
  });

  // --- Socket.IO ---
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_event', (eventId) => {
      socket.join(eventId);
      console.log(`Socket ${socket.id} joined event ${eventId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
