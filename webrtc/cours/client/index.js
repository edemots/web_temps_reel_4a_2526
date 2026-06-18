document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.getElementById("joinBtn");
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  const ws = new WebSocket("ws://localhost:3000/ws");
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.stunprotocol.org",
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
        ],
      },
    ],
  });

  peerConnection.addEventListener("icecandidate", (event) => {
    if (event.candidate !== null) {
      ws.send(
        JSON.stringify({ type: "iceCandidate", candidate: event.candidate }),
      );
    }
  });

  peerConnection.addEventListener("track", (event) => {
    remoteVideo.srcObject = event.streams[0];
  });

  joinBtn.addEventListener("click", async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    localVideo.srcObject = localStream;

    const offer = await createOffer();
    ws.send(JSON.stringify({ type: "offer", offer }));
  });

  async function createOffer() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    return offer;
  }

  async function createAnswer() {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    return answer;
  }

  ws.onmessage = async (event) => {
    const eventMessage = JSON.parse(event.data);

    if (eventMessage.type === "offer") {
      const offer = eventMessage.offer;
      peerConnection.setRemoteDescription(offer);
      const answer = await createAnswer();
      ws.send(JSON.stringify({ type: "answer", answer }));
    }

    if (eventMessage.type === "answer") {
      const answer = eventMessage.answer;
      peerConnection.setRemoteDescription(answer);
    }

    if (eventMessage.type === "iceCandidate") {
      const candidate = eventMessage.candidate;
      await peerConnection.addIceCandidate(candidate);
    }
  };
});
