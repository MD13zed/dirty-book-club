const router   = require("express").Router();
const multer   = require("multer");
const cloudinary = require("cloudinary").v2;
const { auth } = require("../middleware/auth");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Images only"));
    cb(null, true);
  },
});

// POST /api/uploads/cover
router.post("/cover", auth, upload.single("cover"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });

  try {
    // Convert buffer to base64 data URI for Cloudinary
    const b64     = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder:  "dirty-book-club/covers",
      width:   400,
      height:  600,
      crop:    "fill",
      quality: 85,
      format:  "webp",
    });

    res.json({ url: result.secure_url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
