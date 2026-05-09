import express from "express";
import multer from "multer";
import path from "path";
import { authMiddleware } from "../middleware/auth";

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();
router.use(authMiddleware);

router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  res.json({
    url: `http://localhost:3001/uploads/${req.file.filename}`,
    name: req.file.originalname,
    mime: req.file.mimetype,
  });
});

export default router;
