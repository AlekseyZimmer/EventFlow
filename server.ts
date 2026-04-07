import express from 'express';
import { createServer as createHttpServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import Database from 'better-sqlite3';

const db = new Database('events.db');

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT,
    date TEXT,
    location TEXT,
    status TEXT,
    ownerToken TEXT,
    retentionDays INTEGER DEFAULT 30
  );
  CREATE TABLE IF NOT EXISTS stages (
    id TEXT PRIMARY KEY,
    eventId TEXT,
    name TEXT,
    description TEXT,
    plannedStartTime TEXT,
    plannedEndTime TEXT,
    actualStartTime TEXT,
    actualEndTime TEXT,
    status TEXT,
    responsiblePerson TEXT,
    "order" INTEGER,
    FOREIGN KEY(eventId) REFERENCES events(id) ON DELETE CASCADE
  );
`);

try {
  db.prepare('ALTER TABLE events ADD COLUMN retentionDays INTEGER DEFAULT 30').run();
} catch (e) {
  // Column already exists
}

function cleanupExpiredEvents() {
  try {
    const result = db.prepare("DELETE FROM events WHERE date(date, '+' || retentionDays || ' days') < date('now')").run();
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired events.`);
    }
  } catch (e) {
    console.error('Cleanup error:', e);
  }
}

cleanupExpiredEvents();
setInterval(cleanupExpiredEvents, 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get('/api/events', (req, res) => {
    const ids = req.query.ids as string;
    if (ids) {
      const idArray = ids.split(',');
      const placeholders = idArray.map(() => '?').join(',');
      const stmt = db.prepare(`SELECT * FROM events WHERE id IN (${placeholders})`);
      const rows = stmt.all(...idArray);
      res.json(rows.map((r: any) => ({ ...r, ownerToken: undefined })));
    } else {
      const rows = db.prepare('SELECT * FROM events').all();
      res.json(rows.map((r: any) => ({ ...r, ownerToken: undefined })));
    }
  });

  app.post('/api/events', (req, res) => {
    const { name, date, location, retentionDays } = req.body;
    const newEvent = {
      id: uuidv4(),
      name,
      date,
      location,
      status: 'planned',
      ownerToken: uuidv4(),
      retentionDays: retentionDays || 30
    };
    db.prepare('INSERT INTO events (id, name, date, location, status, ownerToken, retentionDays) VALUES (@id, @name, @date, @location, @status, @ownerToken, @retentionDays)').run(newEvent);
    res.status(201).json(newEvent);
  });

  app.get('/api/events/:id', (req, res) => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) as any;
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ ...event, ownerToken: undefined });
  });

  app.delete('/api/events/:id', (req, res) => {
    const eventId = req.params.id;
    const token = req.headers['x-owner-token'] as string;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event) return res.status(404).json({error: 'Not found'});
    if (event.ownerToken !== token) return res.status(403).json({error: 'Unauthorized'});

    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);
    res.json({success: true});
  });

  app.get('/api/events/:id/stages', (req, res) => {
    const stages = db.prepare('SELECT * FROM stages WHERE eventId = ? ORDER BY "order" ASC').all(req.params.id);
    res.json(stages);
  });

  app.post('/api/events/:id/stages', (req, res) => {
    const eventId = req.params.id;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event || event.ownerToken !== req.headers['x-owner-token']) return res.status(403).json({error: 'Unauthorized'});

    const { name, description, plannedStartTime, plannedEndTime, responsiblePerson } = req.body;
    const countRow = db.prepare('SELECT COUNT(*) as c FROM stages WHERE eventId = ?').get(eventId) as any;
    const order = countRow.c;

    const newStage = {
      id: uuidv4(),
      eventId,
      name,
      description: description || '',
      plannedStartTime,
      plannedEndTime,
      actualStartTime: null,
      actualEndTime: null,
      status: 'pending',
      responsiblePerson: responsiblePerson || '',
      order
    };

    db.prepare(`INSERT INTO stages (id, eventId, name, description, plannedStartTime, plannedEndTime, actualStartTime, actualEndTime, status, responsiblePerson, "order")
                VALUES (@id, @eventId, @name, @description, @plannedStartTime, @plannedEndTime, @actualStartTime, @actualEndTime, @status, @responsiblePerson, @order)`).run(newStage);

    // Sort stages by plannedStartTime and update order
    const allStages = db.prepare('SELECT * FROM stages WHERE eventId = ?').all(eventId) as any[];
    allStages.sort((a, b) => new Date(a.plannedStartTime).getTime() - new Date(b.plannedStartTime).getTime());
    
    const updateStmt = db.prepare('UPDATE stages SET "order" = ? WHERE id = ?');
    const transaction = db.transaction((stagesToUpdate) => {
      stagesToUpdate.forEach((s: any, i: number) => updateStmt.run(i, s.id));
    });
    transaction(allStages);

    io.to(eventId).emit('schedule_updated');
    res.status(201).json(newStage);
  });

  app.post('/api/events/:id/stages/bulk', (req, res) => {
    const eventId = req.params.id;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event || event.ownerToken !== req.headers['x-owner-token']) return res.status(403).json({error: 'Unauthorized'});

    const newStagesData = req.body.stages;
    const countRow = db.prepare('SELECT COUNT(*) as c FROM stages WHERE eventId = ?').get(eventId) as any;
    let currentOrder = countRow.c;

    const insertStmt = db.prepare(`INSERT INTO stages (id, eventId, name, description, plannedStartTime, plannedEndTime, actualStartTime, actualEndTime, status, responsiblePerson, "order")
                VALUES (@id, @eventId, @name, @description, @plannedStartTime, @plannedEndTime, @actualStartTime, @actualEndTime, @status, @responsiblePerson, @order)`);

    const transaction = db.transaction((stagesToAdd) => {
      stagesToAdd.forEach((s: any) => {
        insertStmt.run({
          id: uuidv4(),
          eventId,
          name: s.name,
          description: s.description || '',
          plannedStartTime: s.plannedStartTime,
          plannedEndTime: s.plannedEndTime,
          actualStartTime: null,
          actualEndTime: null,
          status: 'pending',
          responsiblePerson: s.responsiblePerson || '',
          order: currentOrder++
        });
      });
    });
    transaction(newStagesData);

    // Sort by time
    const allStages = db.prepare('SELECT * FROM stages WHERE eventId = ?').all(eventId) as any[];
    allStages.sort((a, b) => new Date(a.plannedStartTime).getTime() - new Date(b.plannedStartTime).getTime());
    
    const updateStmt = db.prepare('UPDATE stages SET "order" = ? WHERE id = ?');
    const sortTransaction = db.transaction((stagesToUpdate) => {
      stagesToUpdate.forEach((s: any, i: number) => updateStmt.run(i, s.id));
    });
    sortTransaction(allStages);

    io.to(eventId).emit('schedule_updated');
    res.status(201).json({ success: true });
  });

  app.patch('/api/events/:id/stages/reorder', (req, res) => {
    const eventId = req.params.id;
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) as any;
    if (!event || event.ownerToken !== req.headers['x-owner-token']) return res.status(403).json({error: 'Unauthorized'});

    const { stageIds } = req.body;
    const updateStmt = db.prepare('UPDATE stages SET "order" = ? WHERE id = ? AND eventId = ?');
    const transaction = db.transaction((ids) => {
      ids.forEach((id: string, index: number) => updateStmt.run(index, id, eventId));
    });
    transaction(stageIds);

    io.to(eventId).emit('schedule_updated');
    res.json({ success: true });
  });

  app.patch('/api/stages/:id/status', (req, res) => {
    const stageId = req.params.id;
    const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(stageId) as any;
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(stage.eventId) as any;
    if (!event || event.ownerToken !== req.headers['x-owner-token']) return res.status(403).json({error: 'Unauthorized'});

    const { status, time } = req.body;
    
    if (status === 'active') {
      db.prepare('UPDATE stages SET status = ?, actualStartTime = ? WHERE id = ?').run(status, time, stageId);
      if (event.status === 'planned') {
        db.prepare('UPDATE events SET status = ? WHERE id = ?').run('active', event.id);
        event.status = 'active';
        io.to(event.id).emit('event_updated', event);
      }
    } else if (status === 'completed') {
      db.prepare('UPDATE stages SET status = ?, actualEndTime = ? WHERE id = ?').run(status, time, stageId);
    }

    const updatedStage = db.prepare('SELECT * FROM stages WHERE id = ?').get(stageId);
    io.to(stage.eventId).emit('stage_updated', updatedStage);
    io.to(stage.eventId).emit('schedule_updated');
    res.json(updatedStage);
  });

  app.patch('/api/stages/:id/timing', (req, res) => {
    const stageId = req.params.id;
    const stage = db.prepare('SELECT * FROM stages WHERE id = ?').get(stageId) as any;
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(stage.eventId) as any;
    if (!event || event.ownerToken !== req.headers['x-owner-token']) return res.status(403).json({error: 'Unauthorized'});

    const { plannedStartTime, plannedEndTime } = req.body;
    db.prepare('UPDATE stages SET plannedStartTime = COALESCE(?, plannedStartTime), plannedEndTime = COALESCE(?, plannedEndTime) WHERE id = ?')
      .run(plannedStartTime, plannedEndTime, stageId);

    const updatedStage = db.prepare('SELECT * FROM stages WHERE id = ?').get(stageId);
    io.to(stage.eventId).emit('stage_updated', updatedStage);
    io.to(stage.eventId).emit('schedule_updated');
    res.json(updatedStage);
  });

  io.on('connection', (socket) => {
    socket.on('join_event', (eventId) => {
      socket.join(eventId);
    });
  });

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
