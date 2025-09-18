// backend/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import { Server } from "socket.io";

// import routes
import userRoutes from "./routes/userRoutes.js";
import medicineRoutes from "./routes/medicineRoutes.js";
import doctorAuthRoutes from "./routes/doctorAuth.js";
import consultationRoutes from "./routes/consultationRoutes.js";
import recordRoutes from "./routes/recordRoutes.js";
import pharmacyRoutes from "./routes/pharmacyRoutes.js";
import pharmacyAuthRoutes from "./routes/pharmacyAuthRoutes.js";
import billRoutes from "./routes/billRoutes.js";

// persistence model
import Consultation from "./models/Consultation.js";

// server.js (near top, after imports)
import fs from "fs";
// import path from "path";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("Created uploads directory:", uploadsDir);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => res.send("Nabha Healthcare API running"));

// mount routes
app.use("/api/users", userRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/doctors", doctorAuthRoutes);
app.use("/api/consultations", consultationRoutes);
app.use("/api/health-records", recordRoutes);
app.use("/api/pharmacies", pharmacyRoutes);
app.use("/api/pharmacy-auth", pharmacyAuthRoutes);
app.use("/api/bills", billRoutes);

// 404 handler
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// error handler
app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err.message);
  console.error(err.stack);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
});

// -------------------- SOCKET.IO SETUP --------------------
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: "*", // lock this down in production
//     methods: ["GET", "POST"],
//   },
// });

// new
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // add any dev origins you use
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
  },
  // allowEIO3 helps with older clients (safe to enable in dev)
  allowEIO3: true,
  // optional tuning
  pingInterval: 25000,
  pingTimeout: 60000,
});


// new
// make io available to routes via req.app.get('io')
app.set("io", io);

io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

    // log transport (polling or websocket) once connected
  try {
    const transportName = socket.conn.transport.name;
    console.log(`   transport for ${socket.id}:`, transportName);
  } catch (e) {
    // ignore if not available yet
  }

  // ---- joinRoom handler ----
  // expects { consultationId, userId, role }
  socket.on("joinRoom", async ({ consultationId, userId, role }) => {
    try {
      // Basic validation
      if (!consultationId || !userId) {
        console.warn("[joinRoom] missing consultationId or userId");
        socket.emit("error", "Missing consultationId or userId");
        return;
      }

      // Save user identity on socket for debugging / later checks
      socket.data.userId = userId;
      socket.data.role = role || "user";

      // Validate consultation and membership (doctor or patient)
      const consultation = await Consultation.findById(consultationId).populate("doctor patient");
      if (!consultation) {
        console.warn(`[joinRoom] consultation not found: ${consultationId}`);
        socket.emit("error", "Consultation not found.");
        return;
      }

      const isAllowed =
        (consultation.patient && consultation.patient._id.toString() === userId) ||
        (consultation.doctor && consultation.doctor._id.toString() === userId);

      if (!isAllowed) {
        console.warn(`[joinRoom] unauthorized join attempt by ${userId} for ${consultationId}`);
        socket.emit("error", "Unauthorized to join this consultation.");
        return;
      }

      // join the room (Socket.IO deduplicates if already joined)
      socket.join(consultationId);
      console.log(`📌 ${socket.data.role} (${userId}) joined ${consultationId} on socket ${socket.id}`);

      // broadcast current peer-count to everyone in the room
      const clients = await io.in(consultationId).allSockets();
      const peerCount = clients.size;
      io.to(consultationId).emit("peer-count", peerCount);
      console.log(`Room ${consultationId} peer-count = ${peerCount}`);
    } catch (err) {
      console.error("❌ joinRoom validation failed:", err);
      socket.emit("error", "Server error while joining room.");
    }
  });

  // ---- Forward offer from initiator to the other peers in the room ----
  // payload: { consultationId, offer }
  socket.on("offer", ({ consultationId, offer }) => {
    if (!consultationId || !offer) return;
    console.log(`🔁 offer received for room ${consultationId} from ${socket.id} -> forwarding`);
    socket.to(consultationId).emit("offer", offer);
  });

  // ---- Forward answer ----
  // payload: { consultationId, answer }
  socket.on("answer", ({ consultationId, answer }) => {
    if (!consultationId || !answer) return;
    console.log(`🔁 answer received for room ${consultationId} from ${socket.id} -> forwarding`);
    socket.to(consultationId).emit("answer", answer);
  });

  // ---- Forward ICE candidates ----
  // payload: { consultationId, candidate }
  socket.on("ice-candidate", ({ consultationId, candidate }) => {
    if (!consultationId) return;
    // candidate may be null sometimes
    socket.to(consultationId).emit("ice-candidate", candidate);
  });

  // ---- Call control: patient requests call to doctor(s) ----
  // patient -> server -> doctor(s)
  socket.on("call-request", ({ consultationId }) => {
    if (!consultationId) return;
    console.log(`🔔 call-request for room ${consultationId} from ${socket.id}`);
    // forward to everyone else in room (doctors will show incoming UI)
    socket.to(consultationId).emit("call-request");
  });

  // ---- Call accepted by doctor -> notify patient(s) ----
  socket.on("call-accepted", ({ consultationId }) => {
    if (!consultationId) return;
    console.log(`✅ call-accepted for room ${consultationId} from ${socket.id}`);
    socket.to(consultationId).emit("call-accepted");
  });

  // ---- Call declined by doctor -> notify patient(s) ----
  // payload: { consultationId, reason }
  socket.on("call-declined", ({ consultationId, reason }) => {
    if (!consultationId) return;
    console.log(`⛔ call-declined for ${consultationId} (reason: ${reason || "none"})`);
    socket.to(consultationId).emit("call-declined", { reason: reason || "declined by remote" });
  });

  // ---- End call notify (single broadcast) ----
  // payload: { consultationId }
  socket.on("end-call", ({ consultationId }) => {
    if (!consultationId) return;
    console.log(`📴 end-call for room ${consultationId} -> broadcasting`);
    // Broadcast to entire room (including sender). Clients must NOT re-emit on receipt.
    io.to(consultationId).emit("end-call");
  });

  // ---- Chat message handler ----
  // payload: { consultationId, userId, sender, message }
  socket.on("sendMessage", async ({ consultationId, userId, sender, message }) => {
    try {
      if (!consultationId || !message) return;

      // if you have a Message model, you could save to DB here
      // const newMsg = await Message.create({ consultationId, sender, message });

      // For now just forward the message to everyone in the room
      const msg = {
        consultationId,
        sender,
        message,
        timestamp: new Date(),
      };
      io.to(consultationId).emit("receiveMessage", msg);
    } catch (err) {
      console.error("❌ sendMessage error:", err);
      socket.emit("error", "Message could not be sent");
    }
  });

  // ---- Handle disconnecting (rooms before leaving) ----
  socket.on("disconnecting", () => {
    const rooms = Array.from(socket.rooms); // includes socket.id
    // we don't emit here — we'll update peer counts in 'disconnect' after the socket leaves
    // but keep this log for debugging
    if (rooms.length > 1) {
      console.log(`[disconnecting] socket ${socket.id} leaving rooms: ${rooms.filter(r => r !== socket.id).join(", ")}`);
    }
  });

  // ---- Handle disconnect: update rooms' peer-counts ----
  socket.on("disconnect", async (reason) => {
    console.log("❌ Client disconnected:", socket.id, "reason:", reason, "userId:", socket.data?.userId);
    try {
      // Iterate adapter rooms and update peer counts for each "real" room (skip socket id rooms)
      for (const [roomName, s] of io.sockets.adapter.rooms) {
        // roomName that matches a socket id => skip
        if (io.sockets.sockets.has(roomName)) continue;
        const clients = await io.in(roomName).allSockets();
        const peerCount = clients.size;
        io.to(roomName).emit("peer-count", peerCount);
      }
    } catch (err) {
      console.error("Error updating peer counts after disconnect:", err);
    }
  });
});

// -------------------- START SERVER --------------------
server.listen(PORT, () => console.log(`🚀 Server + WebSocket running on port ${PORT}`));
