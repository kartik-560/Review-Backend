import express from 'express';
import prisma from '../config/prismaConfig.js';
import multer from 'multer';
const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${extension}`);
  }
});

const upload = multer({ storage });

router.get('/', async (req, res) => {
  try {
    const reviews = await prisma.cleanerReview.findMany({
      include: { location: true },
    });

    const serialized = reviews.map((r) => ({
      ...r,
      id: r.id.toString(),
      site_id: r.site_id.toString(),
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
      location: {
        ...r.location,
        id: r.location.id.toString(),
        created_at: r.location.created_at.toISOString(),
        updated_at: r.location.updated_at.toISOString()
      }
    }));

    res.json(serialized);
  } catch (err) {
    console.error("Fetch Cleaner Reviews Error:", err);
    res.status(500).json({
      error: 'Failed to fetch cleaner reviews',
      detail: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
    });
  }
});



router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const { site_id, name, phone, remarks } = req.body;

    // Access uploaded file paths
    const imageFilenames = req.files.map(file => file.filename);

    const review = await prisma.cleanerReview.create({
      data: {
        site_id: BigInt(site_id),
        name,
        phone,
        remarks,
        images: imageFilenames,
      },
    });

    const serializedReview = {
      ...review,
      id: review.id.toString(),
      site_id: review.site_id.toString(),
      created_at: review.created_at.toISOString(),
      updated_at: review.updated_at.toISOString()
    };

    res.status(201).json(serializedReview);
  } catch (err) {
    console.error("Create Review Error:", err);
    res.status(400).json({
      error: "Failed to create review",
      detail: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
    });
  }
});
export default router;