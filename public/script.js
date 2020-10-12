const socket = io('/');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localSocketId;

const serverConfig = {
  iceServers: [
    {
      urls: 'stun:stun.stunprotocol.org',
    },
    {
      urls: 'turn:numb.viagenie.ca',
      credential: 'muazkh',
      username: 'webrtc@live.com',
    },
  ],
};

let peerConnection = new RTCPeerConnection(serverConfig);
let localStream;
navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
  localStream = stream;
  localVideo.srcObject = stream;

  socket.emit('join-room', ROOM_ID);

  socket.on('offer', ({ caller, offer }) => {
    peerConnection.onnegotiationneeded = () => startNegotiation(caller);
    peerConnection.onicecandidate = (e) => handleIceCandidate(e, caller);

    peerConnection.ontrack = ({ streams }) => {
      if (remoteVideo.srcObject) return;
      remoteVideo.srcObject = streams[0];
    };
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }

    peerConnection
      .setRemoteDescription(offer)
      .then(() => {
        return peerConnection.createAnswer();
      })
      .then((answer) => {
        peerConnection.setLocalDescription(answer);
        return answer;
      })
      .then((answer) => {
        console.log('Emitted answer', answer);
        socket.emit('answer', {
          caller,
          answer,
        });
      })
      .catch((e) => console.log('Error negotiating offer', e));
  });

  socket.on('answer', (answer) => {
    console.log('Answer received:', answer);
    peerConnection
      .setRemoteDescription(answer)
      .catch((e) => console.log('Error handling answer:', e));
  });

  socket.on('ice-candidate', (message) => {
    const candidate = new RTCIceCandidate(message);
    console.log('Received ICE candidate', candidate.toJSON());
    peerConnection
      .addIceCandidate(candidate.toJSON())
      .catch((e) => console.log('Error adding ICE candidate', e));
  });
});

function startCall(otherUserId) {
  console.log('Starting call');
  try {
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }

    peerConnection.onnegotiationneeded = () => startNegotiation(otherUserId);
    peerConnection.onicecandidate = (e) => handleIceCandidate(e, otherUserId);
    peerConnection.ontrack = ({ streams }) => {
      if (remoteVideo.srcObject) return;
      remoteVideo.srcObject = streams[0];
    };
  } catch (err) {
    console.log('Error starting connection:', err);
  }
}

function startNegotiation(otherUserId) {
  peerConnection
    .createOffer()
    .then((offer) => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.emit('offer', {
        target: otherUserId,
        caller: localSocketId,
        offer: peerConnection.localDescription,
      });
    });
}

function handleIceCandidate(e, otherUserId) {
  if (e.candidate) {
    socket.emit('ice-candidate', {
      target: otherUserId,
      candidate: e.candidate,
    });
  }
}

socket.on('connect', () => (localSocketId = socket.id));
socket.on('other-user', (otherUserId) => {
  startCall(otherUserId);
});
