import express from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (_req, res) => {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(rooms);
});

router.post("/", async (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const room = await prisma.room.create({ data: { name: name.trim() } });
  res.status(201).json(room);
});

router.get("/:id", async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json(room);
});

router.delete("/:id/messages", async (req, res) => {
  await prisma.message.deleteMany({ where: { roomId: Number(req.params.id) } });
  res.status(204).end();
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.message.deleteMany({ where: { roomId: id } });
  await prisma.room.delete({ where: { id } });
  res.status(204).end();
});

export default router;
