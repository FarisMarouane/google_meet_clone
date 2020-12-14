const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new  FileSync('db.json')
const db = low(adapter)

db.set('rooms', {}).write();

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.set('view engine', 'ejs');
app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/assets', express.static('public/assets'));

app.get('/', (req, res) => {
  res.render('home');
});

app.post('/register_room', (req, res) => {
  const roomName = req.body.name;
  const uniqueRoomName = `${roomName}${uuidv4()}`;

  db.set(`rooms[${uniqueRoomName}]`, {}).write();

  res.redirect(`/${uniqueRoomName}/new_participant`);
});

app.get('/:roomId/new_participant', (req, res) => {
  res.render('new_participant', { roomId: req.params.roomId });
});

app.post('/:roomId/register_participant', (req, res) => {
  const participantName = req.body.name;
  const roomId = req.params.roomId;

  res.redirect(`/room/${roomId}`);
});

app.get('/room/:roomId', (req, res) => {
  const userName = req.query.user;
  res.render('room', { roomId: req.params.roomId, userName });
});

io.on('connection', (socket) => {
  let room_id;
  socket.on('join-room', (roomId, USE_ID) => {
    room_id = roomId;
    const rooms = db.get('rooms').value();
    console.log('rooms 1', rooms);
    if (rooms[roomId]) {
      db.set(`rooms[${roomId}][${socket.id}]`, USE_ID).write();
    } else {
      throw Error(`Room ${roomId} doesn't exist`);
    }
    console.log(`${socket.id} joined room`, roomId);
    const otherUsers =  Object.keys(rooms[roomId])
      ?.filter((id) => id !== socket.id);
    if (otherUsers?.length > 0) {
      socket.emit('other-users', otherUsers);
    }
  });

  socket.on('offer', ({ offer, target, caller }) => {
    io.to(target).emit('offer', { caller, offer, target });
  });

  socket.on('answer', ({ caller, answer, target }) => {
    io.to(caller).emit('answer', { answer, target });
  });

  socket.on('disconnect', () => {
    // Remove disconnected user from room
    const rooms = db.get('rooms').value();
    console.log('rooms', rooms);
    if (rooms[room_id]) {
      rooms[room_id] = rooms[room_id].filter((id) => id !== socket.id);
    }
    socket.broadcast.emit('user disonnected', { userId: socket.id });
  });

  socket.on('ice-candidate', ({ target, caller, candidate }) => {
    io.to(target).emit('ice-candidate', {
      caller,
      candidateMessage: candidate,
    });
  });
});

server.listen(port);
