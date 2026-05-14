import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma";
import authRouter from "./routes/auth";
import roomsRouter from "./routes/rooms";
import messagesRouter from "./routes/messages";
import uploadRouter from "./routes/upload";
import usersRouter from "./routes/users";
import dmRouter from "./routes/dm";
import reactionsRouter from "./routes/reactions";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://chat-app-zeta-nine-45.vercel.app",
];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/upload", uploadRouter);
app.use("/users", usersRouter);
app.use("/dm", dmRouter);
app.use("/messages", reactionsRouter);
app.use("/rooms/:roomId/messages", messagesRouter); // more specific first
app.use("/rooms", roomsRouter);

io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return next(new Error("No token"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
    };
    socket.data.userId = decoded.id;
    socket.data.userEmail = decoded.email;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

const onlineUsers = new Map<number, Set<string>>();

function broadcastOnline() {
  io.emit("users_online", [...onlineUsers.keys()]);
}

io.on("connection", (socket) => {
  const userId = socket.data.userId as number;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socket.id);
  broadcastOnline();

  socket.on("disconnect", () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) onlineUsers.delete(userId);
    }
    broadcastOnline();
  });

  socket.on("join_room", (roomId: number) => socket.join(`room:${roomId}`));
  socket.on("leave_room", (roomId: number) => socket.leave(`room:${roomId}`));

  socket.on("room_cleared", (roomId: number) => {
    io.to(`room:${roomId}`).emit("messages_cleared", roomId);
  });

  socket.on("room_deleted", (roomId: number) => {
    io.emit("room_deleted", roomId);
  });

  socket.on(
    "send_message",
    async ({
      roomId,
      content,
      fileUrl,
      fileName,
      fileMime,
    }: {
      roomId: number;
      content: string;
      fileUrl?: string;
      fileName?: string;
      fileMime?: string;
    }) => {
      try {
        const message = await prisma.message.create({
          data: {
            content: content?.trim() ?? "",
            fileUrl,
            fileName,
            fileMime,
            userId: socket.data.userId,
            roomId,
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            reactions: { include: { user: { select: { id: true, name: true } } } },
          },
        });
        io.to(`room:${roomId}`).emit("new_message", message);
      } catch {
        socket.emit("error", "Failed to send message");
      }
    },
  );

  socket.on(
    "reaction_broadcast",
    ({
      messageId,
      reactions,
      roomId,
    }: {
      messageId: number;
      reactions: unknown;
      roomId: number;
    }) => {
      io.to(`room:${roomId}`).emit("reaction_updated", { messageId, reactions });
    },
  );
});

httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Allowed origins:", ALLOWED_ORIGINS);
  await prisma.$connect();
  console.log("Database connected");
});
