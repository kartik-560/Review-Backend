import express from 'express';
import cors from 'cors';
import cleanerReviewRoutes from './routes/CleanerReview.js';
import locationRoutes from './routes/locationRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Use routes
app.use('/cleaner-reviews', cleanerReviewRoutes);
app.use('/locations', locationRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});
