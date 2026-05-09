import express from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router();
router.use(authMiddleware);

const MEMBER_SELECT = { id: true, name: true, email: true } as const;

router.get("/", async (req: AuthRequest, res) => {
  const rooms = await prisma.room.findMany({
    where: {
      isPrivate: true,
      members: { some: { id: req.userId } },
    },
    include: { members: { select: MEMBER_SELECT } },
    orderBy: { createdAt: "desc" },
  });
  res.json(rooms);
});

router.post("/", async (req: AuthRequest, res) => {
  const { userId: otherUserId } = req.body as { userId: number };
  if (!otherUserId || otherUserId === req.userId) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const ids = [req.userId!, otherUserId].sort((a, b) => a - b);
  const name = `dm:${ids[0]}-${ids[1]}`;

  let room = await prisma.room.findFirst({
    where: { name, isPrivate: true },
    include: { members: { select: MEMBER_SELECT } },
  });

  if (!room) {
    room = await prisma.room.create({
      data: {
        name,
        isPrivate: true,
        members: { connect: [{ id: req.userId }, { id: otherUserId }] },
      },
      include: { members: { select: MEMBER_SELECT } },
    });
  }

  res.json(room);
});

export default router;
