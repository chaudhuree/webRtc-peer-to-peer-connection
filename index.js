let APP_ID = "<collect the agora project id from agora console>";

let uid = String(Math.floor(Math.random() * 1000001));

let token = null;

let client; // client login with

let channel; // channel for chat

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let room = urlParams.get("room");
console.log("room", room);

if (!room) {
  window.location.href = "lobby.html";
}

let localStream;
let remoteStream;
let peerConnection;

// stun server is used to get the public ip address of the user
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};
let constraints = {
  video: {
    width: {min:640, ideal:1920,max: 1920 },
    height: {min:480,ideal:1080, max: 1080 },
  },
  audio: true,

}
// main function
let init = async () => {
  // // agora rtc sdk initialization
  client = AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  // // create channel
  channel = client.createChannel(room);
  await channel.join();

  // when new user join the channel we will get the event and also create and send the offer to the new user
  channel.on("MemberJoined", handleUserJoined);
  // when member leave the channel we will get the event
  channel.on("MemberLeft", handleUserLeft);
  //event listerner to get the message from other user
  client.on("MessageFromPeer", handleMessageFromPeer);

  //permission for camera and microphone
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  document.getElementById("user-1").srcObject = localStream;
};

// handle user joined
let handleUserJoined = async (receiverID) => {
  // console.log("User Joined: ", receiverID);
  // create offer
  createOffer(receiverID);
};

// handle user left
let handleUserLeft = async (MemberId) => {
  // console.log("User Left: ", MemberId);
  // if (peerConnection) {
  //   peerConnection.close();
  // }
  document.getElementById("user-2").style.display = "none";
  document.getElementById('user-1').classList.remove('smallFrame');
};

let createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById('user-1').classList.add('smallFrame')
  document.getElementById("user-2").style.display = "block";
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        MemberId
      );
    }
  };
};

// handle message from peer
let handleMessageFromPeer = async (message, senderId) => {
  message = JSON.parse(message.text);

  if (message.type === "offer") {
    createAnswer(senderId, message.offer);
  }
  if (message.type === "answer") {
    addAnswer(message.answer);
  }
  if (message.type === "candidate") {
    if (peerConnection) {
      await peerConnection.addIceCandidate(message.candidate);
    }
  }
};

// create offer
let createOffer = async (receiverID) => {
  // create initial peer connection (this is the connection between the two users which will be used to send the video and audio data)
  // and peerConnection a stunserver add korte hobe jate kore public ip pawa jay.server ta upore create kora hoyeche. and oitake RTCPeerConnection a pass kora hoyeche
  peerConnection = new RTCPeerConnection(servers);

  // receiver er data show korar jonno ekta stream create kora hoyeche
  // aitay akhn kono data nai just system ta k ready korano hoitice
  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";
  document.getElementById('user-1').classList.add('smallFrame')

  // check localstrer is ready or not
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
    document.getElementById("user-1").srcObject = localStream;
  }

  // localstream er data gulo peerConnection a add korte hobe jate receiver ai data gulo pay
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // akhn peerConnection a akta listener add kora hobe jate jokhn receiver er data gulo return ashbe tokhn amra seita remoteStream a add korte pari
  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track); // upore amra remoteStream ta k prepared korechi and akhn seitai receiver er data gulo add korteci like audo and video
    });
  };

  // create ice candidate
  // ice candidate is used to find the public ip address of the user
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        receiverID
      );
    }
  };
  // create offer[every peer connection has two sides, one is offer and another is answer -> this is the offer side]
  let offer = await peerConnection.createOffer();
  // peerConnection a amar local description set kora hoyeche like ami k. ki offer korte chacci
  await peerConnection.setLocalDescription(offer);

  // now we have to send this offer to the receiver using a signaling server
  // amra agora use kore ai signal send korbo. ai signal websocket dea o kora jay
  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", offer: offer }) },
    receiverID
  );
};

// create answer
let createAnswer = async (callerID, offer) => {
  await createPeerConnection(callerID);

  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();

  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer: answer }) },
    callerID
  );
};

// add answer
let addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    await peerConnection.setRemoteDescription(answer);
  }
};

// leave channel when user want to leave with button press or close the window
let leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};



let toggleCamera = async () => {
  let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

  if(videoTrack.enabled){
      videoTrack.enabled = false
      document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
  }else{
      videoTrack.enabled = true
      document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
  }
}

let toggleMic = async () => {
  let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

  if(audioTrack.enabled){
      audioTrack.enabled = false
      document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
  }else{
      audioTrack.enabled = true
      document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
  }
}

// for controlling camera and mic button 
document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)
// when user close the window
window.addEventListener("beforeunload", leaveChannel);
// call the main function
init();
