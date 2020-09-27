const socket = io();
// const peer = new Peer(undefined, { host: '/', port: 3001 });

const videoGrid = document.getElementById('video-grid');
const videoElement = document.createElement('video');

navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((mediaStream) => {
    addVideo(videoGrid, mediaStream);
  });

// // peer.on('open', (userId) => {
// socket.emit('join-room', ROOM_ID, 990);
// // });

// socket.on('user-connected', (userId) => {
//   console.log('user-connected', userId);
// });

function addVideo(videoPlacement, stream) {
  videoElement.srcObject = stream;
  videoPlacement.appendChild(videoElement);

  videoElement.addEventListener('loadedmetadata', () => {
    videoElement.play();
  });
}
