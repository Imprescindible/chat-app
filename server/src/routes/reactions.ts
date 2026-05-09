import express from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router();
router.use(authMiddleware);

const REACTION_INCLUDE = {
  user: { select: { id: true, name: true } },
} as const;

router.post("/:id/reactions", async (req: AuthRequest, res) => {
  const messageId = Number(req.params.id);
  const { emoji } = req.body as { emoji: string };
  const userId = req.userId!;

  const existing = await prisma.reaction.findUnique({
    where: { userId_messageId_emoji: { userId, messageId, emoji } },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({ data: { emoji, userId, messageId } });
  }

  const reactions = await prisma.reaction.findMany({
    where: { messageId },
    include: REACTION_INCLUDE,
  });

  res.json({ reactions });
});

export default router;
