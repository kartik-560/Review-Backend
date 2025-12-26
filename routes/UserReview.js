import express from "express";
import prisma from "../config/prismaConfig.js";
import { processAndUploadImages, upload } from "../middleware/imageUpload.js";
const router = express.Router();

export default router;

const normalizeBigInt = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "bigint") {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeBigInt(item));
  }

  if (typeof obj === "object") {
    const normalized = {};
    for (const key in obj) {
      normalized[key] = normalizeBigInt(obj[key]);
    }
    return normalized;
  }

  return obj;
};

// ✅ Helper function to generate unique 6-digit token
const generateUniqueToken = async () => {
  let token;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Try 100 times before fallback

  while (!isUnique && attempts < maxAttempts) {
    // ✅ Generate 6-digit number (100000-999999)
    token = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if token already exists
    const existing = await prisma.user_review_qr.findFirst({
      where: { token_number: token },
    });

    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    // Fallback: use timestamp-based if all random attempts fail
    token = Date.now().toString().slice(-6);
    console.warn("⚠️ Using fallback token generation");
  }

  console.log(
    `✅ Generated unique 6-digit token: ${token} (attempts: ${attempts})`
  );
  return token;
};

router.post(
  "/user-review",
  upload.fields([{ name: "images", maxCount: 5 }]),
  processAndUploadImages([
    { fieldName: "images", folder: "user-reviews", maxCount: 5 },
  ]),
  async (req, res) => {
    console.log("in review routes post");
    console.log("POST request made for user_review");

    try {
      const body = req.body;
      console.log("Received body:", body);
      console.log("Uploaded files:", req.uploadedFiles);

      // Parse reason_ids safely
      const reasonIds = JSON.parse(body.reason_ids || "[]");

      // Get Cloudinary URLs from middleware
      const imageUrls = req.uploadedFiles?.images || [];

      const lat = parseFloat(body.latitude);
      const long = parseFloat(body.longitude);

      const frontendRating = parseFloat(body.rating);

      // ✅ Generate unique 6-digit token during review creation
      const token = await generateUniqueToken();

      const reviewData = {
        rating: frontendRating,
        reason_ids: reasonIds,
        latitude: lat,
        longitude: long,
        description: body.description || "",
        location_id: body.location_id ? BigInt(body.location_id) : null,
        images: imageUrls,
        company_id: body?.companyId,
        token_number: token, // ✅ Add token to review data
      };

      if (body.name) reviewData.name = body.name;
      if (body.email) reviewData.email = body.email;
      if (body.phone) reviewData.phone = body.phone;

      const review = await prisma.user_review_qr.create({
        data: reviewData,
      });

      console.log("✅ Review created with token:", review);
      
      res.status(201).json({
        success: true,
        data: normalizeBigInt(review),
        reviewId: review.id.toString(),
        tokenNumber: token, // ✅ Return token to frontend
        message: "Review submitted successfully!",
      });

      if (imageUrls.length > 0) {
        processUserReviewAIScoring(review, imageUrls);
      } else {
        console.log("⚠️ No images to process for AI scoring");
      }
    } catch (error) {
      console.error("Review creation failed:", error);
      res.status(400).json({
        success: false,
        error: error.message,
        message: "Failed to submit review",
      });
    }
  }
);

// ✅ NEW: PATCH route to update contact details
router.patch("/user-review/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    console.log(`📝 Updating review ${id} with contact details`);

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return res.status(200).json({
        success: true,
        message: "No data provided to update",
      });
    }

    const updatedReview = await prisma.user_review_qr.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    console.log("✅ Review updated:", updatedReview);

    res.status(200).json({
      success: true,
      data: normalizeBigInt(updatedReview),
      message: "Contact details updated successfully!",
    });
  } catch (error) {
    console.error("❌ Review update failed:", error);
    res.status(400).json({
      success: false,
      error: error.message,
      message: "Failed to update contact details",
    });
  }
});

// ✅ GET all reviews with optional filters
router.get("/user-review", async (req, res) => {
  try {
    const {
      location_id,
      company_id,
      min_rating,
      max_rating,
      limit,
      offset,
      sort_by,
      order,
    } = req.query;

    // Build where clause dynamically
    const where = {};

    if (location_id) where.location_id = BigInt(location_id);
    if (company_id) where.company_id = BigInt(company_id);

    if (min_rating || max_rating) {
      where.rating = {};
      if (min_rating) where.rating.gte = parseFloat(min_rating);
      if (max_rating) where.rating.lte = parseFloat(max_rating);
    }

    // Build orderBy clause
    const orderBy = {};
    const sortField = sort_by || "created_at";
    const sortOrder = order || "desc";
    orderBy[sortField] = sortOrder;

    // Fetch reviews with pagination
    const reviews = await prisma.user_review_qr.findMany({
      where,
      orderBy,
      take: limit ? parseInt(limit) : undefined,
      skip: offset ? parseInt(offset) : undefined,
    });

    // Get total count for pagination
    const totalCount = await prisma.user_review_qr.count({ where });

    console.log(`Fetched ${reviews.length} reviews`);

    res.status(200).json({
      success: true,
      data: reviews.map((review) => normalizeBigInt(review)),
      pagination: {
        total: totalCount,
        limit: limit ? parseInt(limit) : reviews.length,
        offset: offset ? parseInt(offset) : 0,
      },
      message: "Reviews fetched successfully!",
    });
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch reviews",
    });
  }
});

// ✅ GET single review by ID
router.get("/user-review/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const review = await prisma.user_review_qr.findUnique({
      where: { id: BigInt(id) },
    });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    console.log("Review fetched:", review);

    res.status(200).json({
      success: true,
      data: normalizeBigInt(review),
      message: "Review fetched successfully!",
    });
  } catch (error) {
    console.error("Failed to fetch review:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch review",
    });
  }
});

// ✅ GET reviews statistics for a toilet
router.get("/user-review/stats/toilet/:location_id", async (req, res) => {
  try {
    const { location_id } = req.params;

    const reviews = await prisma.user_review_qr.findMany({
      where: { location_id: BigInt(location_id) },
      select: { rating: true },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews
        : 0;

    // Count rating distribution
    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    reviews.forEach((review) => {
      const rating = Math.round(review.rating || 0);
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating]++;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        total_reviews: totalReviews,
        average_rating: parseFloat(averageRating.toFixed(2)),
        rating_distribution: ratingDistribution,
      },
      message: "Statistics fetched successfully!",
    });
  } catch (error) {
    console.error("Failed to fetch statistics:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch statistics",
    });
  }
});

// ✅ GET recent reviews
router.get("/user-review/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const reviews = await prisma.user_review_qr.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
    });

    res.status(200).json({
      success: true,
      data: reviews.map((review) => normalizeBigInt(review)),
      message: "Recent reviews fetched successfully!",
    });
  } catch (error) {
    console.error("Failed to fetch recent reviews:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch recent reviews",
    });
  }
});
