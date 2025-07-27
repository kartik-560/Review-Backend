import express from 'express';
import prisma from '../config/prismaConfig.js';

const router = express.Router();

// Create new location
router.post('/', async (req, res) => {
  const { name, address, latitude, longitude } = req.body;

  try {
    const location = await prisma.locations.create({
      data: {
        name,
        address,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    res.status(201).json({
      ...location,
      id: location.id.toString(),
      created_at: location.created_at.toISOString(),
      updated_at: location.updated_at.toISOString(),
    });
  } catch (err) {
    console.error('Error creating location:', err);
    res.status(500).json({
      error: 'Failed to create location',
      detail: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
    });
  }
});

// Get all locations
router.get('/', async (req, res) => {
  try {
    const locations = await prisma.locations.findMany({
      orderBy: { created_at: 'desc' },
    });

    const serialized = locations.map(loc => ({
      ...loc,
      id: loc.id.toString(),
      created_at: loc.created_at.toISOString(),
      updated_at: loc.updated_at.toISOString(),
    }));

    res.json(serialized);
  } catch (err) {
    console.error('Failed to fetch locations:', err);
    res.status(500).json({
      error: 'Failed to fetch locations',
      detail: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
    });
  }
});

// Get one location by ID
router.get('/:id', async (req, res) => {
  const locationId = BigInt(req.params.id);

  try {
    const location = await prisma.locations.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json({
      ...location,
      id: location.id.toString(),
      created_at: location.created_at.toISOString(),
      updated_at: location.updated_at.toISOString(),
    });
  } catch (err) {
    console.error('Failed to fetch location by ID:', err);
    res.status(500).json({
      error: 'Failed to fetch location',
      detail: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
    });
  }
});

export default router;
