import express from 'express';
import { PrismaClient } from '@prisma/client';
import { generateCuisineDescription } from '../prisma/seed/seedHelpers';

const router = express.Router();
const prisma = new PrismaClient();

// Endpoint pentru sortare după timp total (prepTime + cookTime)
router.get('/sorted', async (req, res) => {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        cuisine: true,
      }
    });

    // Sortează manual după timpul total (prepTime + cookTime)
    const sortedRecipes = recipes.sort((a, b) => {
      const totalTimeA = (a.prepTime || 0) + (a.cookTime || 0);
      const totalTimeB = (b.prepTime || 0) + (b.cookTime || 0);
      return totalTimeA - totalTimeB;
    });

    res.json(sortedRecipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Eroare la sortarea rețetelor.' });
  }
});
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


// GET /api/recipes/user/:userId - obține rețetele adăugate de utilizator
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        userId: parseInt(userId),
        isAIGenerated: false,
      },
      include: {
        cuisine: true,
        favorites: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(recipes);
  } catch (error) {
    console.error('Eroare la preluarea rețetelor utilizatorului:', error);
    res.status(500).json({ error: 'Eroare la server' });
  }
});

// GET /api/recipes/ai/:userId - obține rețetele AI generate de utilizator
router.get('/ai/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        userId: parseInt(userId),
        isAIGenerated: true,
      },
      include: {
        cuisine: true,
        favorites: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(recipes);
  } catch (error) {
    console.error('Eroare la preluarea rețetelor AI:', error);
    res.status(500).json({ error: 'Eroare la server' });
  }
});


router.post('/cuisines', async (req, res) => {
  const { name, description, image } = req.body;

  try {
    const finalDescription = description || (await generateCuisineDescription(name));

    const newCuisine = await prisma.cuisine.create({
      data: {
        name,
        description: finalDescription,
        image,
      },
    });

    res.status(201).json(newCuisine);
  } catch (error) {
    console.error("Eroare la adăugarea bucătăriei:", error);
    res.status(500).json({ message: 'Eroare la adăugarea bucătăriei.' });
  }
});

//stergere cuisine
router.delete('/cuisines/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.cuisine.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Bucătăria a fost ștearsă cu succes.' });
  } catch (error) {
    console.error("Eroare la ștergerea bucătăriei:", error);
    res.status(500).json({ message: 'Eroare la ștergerea bucătăriei.' });
  }
});

// Funcție pentru actualizarea imaginii bucătăriei
router.patch('/cuisines/:id/image', async (req, res) => {
  const { id } = req.params;
  const { image } = req.body;
  try {
    const updatedCuisine = await prisma.cuisine.update({
      where: { id: parseInt(id) },
      data: { image }
    });
    res.status(200).json(updatedCuisine);
  } catch (error) {
    console.error("Eroare la actualizarea imaginii bucătăriei:", error);
    res.status(500).json({ message: 'Eroare la actualizarea imaginii bucătăriei.' });
  }
});

//adaugare reteta
router.post('/', async (req, res) => {
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
    cuisineId,
    source,
    userId,
    isAIGenerated,
    isPrivate
  } = req.body;

  try {
    if (userId) {
      const userExists = await prisma.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        console.error("ID utilizator invalid:", userId);
        return res.status(400).json({ message: "Utilizatorul nu există în DB" });
      }
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
        cuisine: { connect: { id: cuisineId } },
        source,
        user: userId ? { connect: { id: userId } } : undefined,
        isAIGenerated: isAIGenerated || false,
        isPrivate: isPrivate || false,
      },
    });

    res.status(201).json(newRecipe);
  } catch (error) {
    console.error("Eroare la adăugarea rețetei:", error);
    res.status(500).json({ message: 'Eroare la adăugarea rețetei.' });
  }
});

// DELETE /api/recipes/:id - șterge o rețetă
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body; // userId-ul celui care încearcă să șteargă

  try {
    // Verifică dacă rețeta există și aparține utilizatorului
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(id) },
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Rețeta nu a fost găsită' });
    }

    if (recipe.userId !== userId) {
      return res.status(403).json({ error: 'Nu ai permisiunea să ștergi această rețetă' });
    }

    // Șterge rețeta (Prisma va șterge automat relațiile cascade)
    await prisma.recipe.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Rețeta a fost ștearsă cu succes' });
  } catch (error) {
    console.error('Eroare la ștergerea rețetei:', error);
    res.status(500).json({ error: 'Eroare la server' });
  }
});

// PATCH /api/recipes/:id - actualizează o rețetă existentă
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
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
    cuisineId,
    source,
    isPrivate
  } = req.body;

  try {
    // Verifică dacă rețeta există
    const existingRecipe = await prisma.recipe.findUnique({
            where: { id: parseInt(id) },
            include: { cuisine: true }
        });
        
        if (!existingRecipe) {
            return res.status(404).json({ error: 'Rețeta nu a fost găsită' });
        }
        

    // Actualizează rețeta cu noile date
    const updatedRecipe = await prisma.recipe.update({
      where: { id: parseInt(id) },
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
        cuisine: cuisineId ? { connect: { id: cuisineId } } : undefined,
        source,
        isPrivate,
      },
    });

    res.json(updatedRecipe);
  } catch (error) {
    console.error('Eroare la actualizarea rețetei:', error);
    res.status(500).json({ error: 'Eroare la server' });
  }
});

// Endpoint pentru căutare după nume sau tip de rețetă
router.get('/search/:query', async (req, res) => {
  const { query } = req.params;

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        OR: [
          {
            title: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            recipeType: {
              contains: query,
              mode: 'insensitive'
            }
          }
        ]
      },
      include: {
        cuisine: true,
      }
    });

    res.json(recipes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Eroare la căutarea rețetelor.' });
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


export default router;
