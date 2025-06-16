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
// router.post('/', async (req, res) => {
//   try {
//     const {
//       title,
//       description,
//       image,
//       ingredients,
//       instructions,
//       prepTime,
//       cookTime,
//       servings,
//       recipeType,
//       cuisineName, 
//       source,
//       userId,
//     } = req.body;

//     if (!title || !cuisineName) {
//       return res.status(400).json({ error: 'Titlu și numele bucătăriei sunt obligatorii' });
//     }
//     const cuisine = await prisma.cuisine.findUnique({ where: { name: cuisineName } });
//     let cuisineId: number;

//     if (!cuisine) {
//       const description = await generateCuisineDescription(cuisineName);
//       const newCuisine = await prisma.cuisine.create({
//         data: {
//           name: cuisineName,
//           description,
//           image: '', // temporar
//         }
//       });
//       cuisineId = newCuisine.id;
//     } else {
//       cuisineId = cuisine.id;
//     }

//     const newRecipe = await prisma.recipe.create({
//       data: {
//         title,
//         description,
//         image,
//         ingredients,
//         instructions,
//         prepTime,
//         cookTime,
//         servings,
//         recipeType,
//         cuisineId,
//         source,
//         userId,
//       },
//     });

//     res.status(201).json(newRecipe);
//   } catch (error) {
//     console.error('Eroare la crearea rețetei:', error);
//     res.status(500).json({ error: 'Eroare la server' });
//   }
// });

// GET /api/recipes/user/:userId - obține rețetele adăugate de utilizator
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const recipes = await prisma.recipe.findMany({
      where: {
        userId: parseInt(userId),
        isAIGenerated: false, // exclude rețetele AI pentru această rută
      },
      include: { 
        cuisine: true,
        reviews: true,
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
        reviews: true,
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

// // PUT /api/recipes/:id - actualizează o rețetă existentă
// router.put('/:id', async (req, res) => {
//   const { id } = req.params;
//   const {
//     title,
//     description,
//     image,
//     ingredients,
//     instructions,
//     prepTime,
//     cookTime,
//     servings,
//     recipeType,
//     cuisineName,
//     isPrivate
//   } = req.body;

//   try {
//     // Verifică dacă rețeta există și aparține utilizatorului
//     const existingRecipe = await prisma.recipe.findUnique({
//       where: { id: parseInt(id) },
//       include: { user: true }
//     });

//     if (!existingRecipe) {
//       return res.status(404).json({ error: 'Rețeta nu a fost găsită' });
//     }

//     // Gestionează bucătăria (similar cu POST)
//     let cuisineId = existingRecipe.cuisineId;
//     if (cuisineName && cuisineName !== existingRecipe.cuisine?.name) {
//       const cuisine = await prisma.cuisine.findUnique({ where: { name: cuisineName } });
      
//       if (!cuisine) {
//         const description = await generateCuisineDescription(cuisineName);
//         const newCuisine = await prisma.cuisine.create({
//           data: {
//             name: cuisineName,
//             description,
//             image: '',
//           }
//         });
//         cuisineId = newCuisine.id;
//       } else {
//         cuisineId = cuisine.id;
//       }
//     }

//     const updatedRecipe = await prisma.recipe.update({
//       where: { id: parseInt(id) },
//       data: {
//         ...(title && { title }),
//         ...(description !== undefined && { description }),
//         ...(image && { image }),
//         ...(ingredients && { ingredients }),
//         ...(instructions && { instructions }),
//         ...(prepTime !== undefined && { prepTime }),
//         ...(cookTime !== undefined && { cookTime }),
//         ...(servings !== undefined && { servings }),
//         ...(recipeType && { recipeType }),
//         ...(cuisineId && { cuisineId }),
//         ...(isPrivate !== undefined && { isPrivate }),
//       },
//       include: { cuisine: true }
//     });

//     res.json(updatedRecipe);
//   } catch (error) {
//     console.error('Eroare la actualizarea rețetei:', error);
//     res.status(500).json({ error: 'Eroare la server' });
//   }
// });

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

// POST /api/recipes/ai-generate - creează o rețetă AI
router.post('/ai-generate', async (req, res) => {
  try {
    const {
      title,
      description,
      ingredients,
      instructions,
      prepTime,
      cookTime,
      servings,
      cuisineName,
      userId,
      isPrivate = false
    } = req.body;

    if (!title || !ingredients || !userId) {
      return res.status(400).json({ error: 'Titlu, ingrediente și userId sunt obligatorii' });
    }

    // Gestionează bucătăria
    let cuisineId = 1; // default
    if (cuisineName) {
      const cuisine = await prisma.cuisine.findUnique({ where: { name: cuisineName } });
      
      if (!cuisine) {
        const description = await generateCuisineDescription(cuisineName);
        const newCuisine = await prisma.cuisine.create({
          data: {
            name: cuisineName,
            description,
            image: '',
          }
        });
        cuisineId = newCuisine.id;
      } else {
        cuisineId = cuisine.id;
      }
    }

    const aiRecipe = await prisma.recipe.create({
      data: {
        title,
        description: description || `Rețetă generată cu AI: ${title}`,
        image: '/img/ai-recipe-default.jpg', // imagine default pentru rețete AI
        ingredients,
        instructions: instructions || '',
        prepTime: prepTime || 30,
        cookTime: cookTime || 30,
        servings: servings || 4,
        recipeType: 'AI Generated',
        cuisineId,
        source: 'AI Generated',
        userId,
        isAIGenerated: true,
        isPrivate
      },
      include: { cuisine: true }
    });

    res.status(201).json(aiRecipe);
  } catch (error) {
    console.error('Eroare la crearea rețetei AI:', error);
    res.status(500).json({ error: 'Eroare la server' });
  }
});

// Adaugă la finalul recipeRoutes.js/ts
router.post('/cuisines', async (req, res) => {
  const { name, description, image } = req.body;

  try {
    // Dacă nu primești descriere, o generezi automat (opțional)
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
// Adaugă la finalul recipeRoutes.js/ts
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


export default router;
