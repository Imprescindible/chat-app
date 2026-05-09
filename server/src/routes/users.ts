import express from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    where: { id: { not: req.userId } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json(users);
});

export default router;
