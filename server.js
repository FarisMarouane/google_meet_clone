const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

let uniqueRoomName;
const rooms = {};

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.set('view engine', 'ejs');
app.use('/css', express.static('public/css'));

app.get('/', (req, res) => {
  res.render('home');
});

app.post('/register_room', (req, res) => {
  const roomName = req.body.name;
  uniqueRoomName = `${roomName}${uuidv4()}`;
  rooms[uniqueRoomName] = [];

  res.redirect(`/${uniqueRoomName}/new_participant`);
});

app.get('/:roomId/new_participant', (req, res) => {
  res.render('new_participant');
});

app.post('/register_participant', (req, res) => {
  // const participantName = req.body.name;
  res.redirect(`/room/${uniqueRoomName}`);
});

app.get('/room/:roomId', (req, res) => {
  res.render('room', { roomId: req.params.roomId });
});

io.on('connection', (socket) => {
  let room_id;
  socket.on('join-room', (roomId) => {
    room_id = roomId;
    if (rooms[roomId]) {
      rooms[roomId].push(socket.id);
    } else {
      rooms[roomId] = [socket.id];
    }
    console.log(`${socket.id} joined`, rooms[roomId]);
    const otherUsers = rooms[roomId]?.filter((id) => id !== socket.id);
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

server.listen(3000);
