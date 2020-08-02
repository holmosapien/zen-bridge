const iMessage = require("./osa");
const fs = require("fs");
const yargs = require("yargs");

function getUserHome() {
  let envlet = process.platform == "win32" ? "USERPROFILE" : "HOME";
  return process.env[envlet];
}

function wsRelay(msg) {
  socket.emit("message", msg);
  return;
}

function notifRelay(s) {
  socket.emit("raw", { type: "notif", data: s });
}

function joinRoom() {
  console.log(process.argv[2], process.argv[3]);

  socket.emit(
    "client:authenticate",
    {
      relay: process.argv[2],
      uuid: process.argv[3],
    },
    (ack, err) => {
      if (ack) {
        socket.emit("client:setName", process.argv[3], (ack, err) => {
          if (ack) {
            console.log("Successfully connected into UUID room.");
            return;
          } else {
            console.error("Could not connect to relay and/or UUID. Exiting...");
            process.exit();
          }
        });
      } else {
        console.error("Could not connect to relay and/or UUID. Exiting...");
        process.exit();
      }
    }
  );
}

function checkForParams() {
  if (process.argv[3] && process.argv[2]) return;

  console.error("Missing parameters! Exiting...");

  process.exit();
}

checkForParams();

let socket = require("socket.io-client")(process.argv[2]);

async function auth() {
  notifRelay(process.argv[3].substring(0, 8));
  joinRoom();

  return true;
}

auth().then(() => {
  console.info("Connected to relay with secret UUID: " + process.argv[3]);

  let self = this;

  socket.on("raw", (req) => {
    console.log(req);

    if (req.type === "handles") {
      iMessage.getHandles().then((handles) => {
        socket.emit("raw", { type: "handles", data: handles })
      })
    }

    if (req.type === "recentContacts") {
      iMessage.getRecentContacts(50).then((c) => {
        socket.emit("raw", { type: "recentContacts", data: c });
      });
    }

    if (req.type === "recentMessages") {
      iMessage.getRecentMessagesFromChat(req.id).then((c) => {
        socket.emit("raw", { type: "recentMessages", id: req.id, data: c });
      });
    }

    if (req.type === "attachment") {
      const filename = req.filename

      fs.readFile(filename.replace("~", getUserHome()), (err, buf) => {
        stats.fileSent++;

        socket.emit("raw", {
          type: "fileTransfer",
          filename: filename,
          buffer: buf.toString("base64")
        });
      })
    }

    if (req.type === "send") {
      iMessage.send(req.id, req.text);
    }

    if (req.type === "join") {
      notifRelay(req.id);
    }

    if (req.type === "ping") {
      notifRelay(process.argv[3]);
    }
  });

  socket.on("join", (s) => {
    notifRelay(s);
  });
});

iMessage.listen().on("message", (msg) => {
  console.log("Received message: ", msg);

  if (msg.fromMe) return;
  wsRelay(msg);
});