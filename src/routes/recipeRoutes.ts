import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/recipes/:id - obține o rețetă după ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(id) }
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Rețeta nu a fost găsită' });
    }

    res.json(recipe);
  } catch (error) {
    console.error('Eroare la preluarea rețetei:', error);
    res.status(500).json({ error: 'Eroare la server' });
  }
});

// Ruta pentru preluarea tuturor rețetelor
router.get('/', async (req, res) => {
  try {
    const recipes = await prisma.recipe.findMany();
    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Eroare la preluarea rețetelor.' });
  }
});

// Ruta pentru preluarea rețetelor după tip
router.get('/type/:type', async (req, res) => {
  const { type } = req.params;

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        recipeType: type,
      },
    });
    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Eroare la filtrarea rețetelor după tip.' });
  }
});

// Ruta pentru preluarea rețetelor după tipul de bucătărie
router.get('/cuisine/:cuisine', async (req, res) => {
  const { cuisine } = req.params;

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        cuisineType: cuisine,
      },
    });
    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Eroare la filtrarea rețetelor după bucătărie.' });
  }
});

export default router;
