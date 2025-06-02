import express from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCuisineDescription } from '../prisma/seed/seedHelpers';

const router = express.Router();
const prisma = new PrismaClient();

// Ruta pentru preluarea tuturor bucatariilor
router.get('/cuisines', async (req, res) => {
  try {
    const cuisines = await prisma.cuisine.findMany();
    res.json(cuisines);
  } catch (error) {
    console.error("Eroare la preluarea bucătăriilor:", error);
    res.status(500).json({ message: 'Eroare la preluarea bucatariilor.' });
  }
});

// Ruta pentru preluarea rețetelor după tipul de bucătărie
router.get('/cuisine/:cuisine', async (req, res) => {
  const { cuisine } = req.params;

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        cuisine: {
          name: cuisine, 
        },
      },
      include: {
        cuisine: true, 
      }
    });

    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Eroare la filtrarea rețetelor după bucătărie.' });
  }
});

// Ruta pentru preluarea tuturor rețetelor
router.get('/', async (req, res) => {
  try {
    const recipes = await prisma.recipe.findMany({
      include: { cuisine: true }, 
    });
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

// GET /api/recipes/:id - obține o rețetă după ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(id) },
      include: { cuisine: true },
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

// POST /api/recipes - creează o rețetă nouă, folosind cuisineName pentru upsert
router.post('/', async (req, res) => {
  try {
    const {
      title,
      description,
      image,
      ingredients,
      instructions,
      prepTime,
      cookTime,
      servings,
      recipeType,
      cuisineName, 
      source,
      userId,
    } = req.body;

    if (!title || !cuisineName) {
      return res.status(400).json({ error: 'Titlu și numele bucătăriei sunt obligatorii' });
    }
    const cuisine = await prisma.cuisine.findUnique({ where: { name: cuisineName } });
    let cuisineId: number;

    if (!cuisine) {
      const description = await generateCuisineDescription(cuisineName);
      const newCuisine = await prisma.cuisine.create({
        data: {
          name: cuisineName,
          description,
          image: '', // temporar
        }
      });
      cuisineId = newCuisine.id;
    } else {
      cuisineId = cuisine.id;
    }

    const newRecipe = await prisma.recipe.create({
      data: {
        title,
        description,
        image,
        ingredients,
        instructions,
        prepTime,
        cookTime,
        servings,
        recipeType,
        cuisineId,
        source,
        userId,
      },
    });

    res.status(201).json(newRecipe);
  } catch (error) {
    console.error('Eroare la crearea rețetei:', error);
    res.status(500).json({ error: 'Eroare la server' });
  }
});


export default router;
