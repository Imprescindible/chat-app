import express from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

const MSG_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  reactions: { include: { user: { select: { id: true, name: true } } } },
} as const;

router.get("/", async (req, res) => {
  const roomId = Number((req.params as { roomId: string }).roomId);
  const search = (req.query.search as string | undefined)?.trim();

  const messages = await prisma.message.findMany({
    where: {
      roomId,
      ...(search ? { content: { contains: search, mode: "insensitive" } } : {}),
    },
    include: MSG_INCLUDE,
    orderBy: { createdAt: "asc" },
    take: search ? 50 : 100,
  });
  res.json(messages);
});

router.delete("/", async (req, res) => {
  const roomId = Number((req.params as { roomId: string }).roomId);
  await prisma.message.deleteMany({ where: { roomId } });
  res.status(204).end();
});

router.post("/", async (req: AuthRequest, res) => {
  const { content, fileUrl, fileName, fileMime } = req.body as {
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileMime?: string;
  };

  if (!content?.trim() && !fileUrl) {
    res.status(400).json({ error: "Content or file is required" });
    return;
  }

  const message = await prisma.message.create({
    data: {
      content: content?.trim() ?? "",
      fileUrl,
      fileName,
      fileMime,
      userId: req.userId!,
      roomId: Number((req.params as { roomId: string }).roomId),
    },
    include: MSG_INCLUDE,
  });
  res.status(201).json(message);
});

export default router;
