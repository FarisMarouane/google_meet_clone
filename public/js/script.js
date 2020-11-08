const socket = io('/');

function createVideoElement(caller) {
  const remoteVideoElement = document.createElement('video');
  remoteVideoElement.setAttribute('class', 'participantVideo');
  remoteVideoElement.setAttribute('id', caller);
  remoteVideoElement.setAttribute('autoplay', '');
  remoteVideoElement.setAttribute('playsinline', '');

  return remoteVideoElement;
}

const videoGridElement = document.getElementsByClassName('videoGrid')[0];
const localVideoElement = videoGridElement.getElementsByClassName(
  'participantVideo',
)[0];

let remoteVideos = {};
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

let peerConnections = {};
let localStream;
navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    localStream = stream;
    localVideoElement.srcObject = stream;
    localVideoElement.setAttribute('id', `${socket.id}`);

    socket.emit('join-room', ROOM_ID);

    socket.on('offer', ({ caller, offer, target }) => {
      try {
        console.log('Starting a RTCPeerConnection with:', caller);
        peerConnections[caller] = new RTCPeerConnection(serverConfig);
      } catch (error) {
        console.log('Error starting a RTCPeerConnection with caller:', caller);
      }

      remoteVideos[caller] = createVideoElement(caller);
      videoGridElement.appendChild(remoteVideos[caller]);

      for (const track of localStream.getTracks()) {
        peerConnections[caller].addTrack(track, localStream);
      }

      peerConnections[caller]
        .setRemoteDescription(offer)
        .then(() => {
          return peerConnections[caller].createAnswer();
        })
        .then((answer) => {
          peerConnections[caller].setLocalDescription(answer);
          return answer;
        })
        .then((answer) => {
          socket.emit('answer', {
            target, // Target is local user in this case
            caller,
            answer,
          });
        })
        .catch((e) => console.log('*** Error negotiating offer', e));

      peerConnections[caller].onicecandidate = (e) =>
        handleIceCandidate(e, caller, target);

      peerConnections[caller].ontrack = ({ streams }) => {
        if (remoteVideos[caller].srcObject) return;
        remoteVideos[caller].srcObject = streams[0];
      };
    });

    socket.on('answer', ({ answer, target }) => {
      peerConnections[target]
        .setRemoteDescription(answer)
        .catch((e) => console.log('*** Error handling answer:', e));
    });

    socket.on('ice-candidate', ({ caller, candidateMessage }) => {
      // Target is local user in this case
      const candidate = new RTCIceCandidate(candidateMessage);
      peerConnections[caller]
        .addIceCandidate(candidate.toJSON())
        .catch((e) => console.log('*** Error adding ICE candidate', e));
    });
  });

function startCall(target) {
  console.log('*** Starting call to user:', target);
  peerConnections[target] = new RTCPeerConnection(serverConfig);
  remoteVideos[target] = createVideoElement(target);
  videoGridElement.appendChild(remoteVideos[target]);
  try {
    for (const track of localStream.getTracks()) {
      peerConnections[target].addTrack(track, localStream);
    }

    peerConnections[target].onnegotiationneeded = () =>
      startNegotiation(target);
    peerConnections[target].onicecandidate = (e) =>
      handleIceCandidate(e, target, localSocketId);
    peerConnections[target].ontrack = ({ streams }) => {
      if (remoteVideos[target].srcObject) return;
      remoteVideos[target].srcObject = streams[0];
    };
  } catch (err) {
    console.log('*** Error starting connection:', err);
  }
}

function startNegotiation(target) {
  peerConnections[target]
    .createOffer()
    .then((offer) => peerConnections[target].setLocalDescription(offer))
    .then(() => {
      socket.emit('offer', {
        target,
        caller: localSocketId,
        offer: peerConnections[target].localDescription,
      });
    });
}

function handleIceCandidate(e, target, caller) {
  if (e.candidate) {
    socket.emit('ice-candidate', {
      target,
      caller,
      candidate: e.candidate,
    });
  }
}

socket.on('connect', () => (localSocketId = socket.id));
socket.on('other-users', (otherUsers) => {
  for (const target of otherUsers) startCall(target);
});

socket.on('user disonnected', ({ userId }) => {
  console.log(`*** User ${userId} disconnected`);
  peerConnections[userId].close();
  delete peerConnections[userId];
  remoteVideos[userId].srcObject = null;
  videoGridElement.removeChild(document.getElementById(userId))
});
