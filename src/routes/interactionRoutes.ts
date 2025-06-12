import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth';

const prisma = new PrismaClient();
const router = express.Router();

router.get('/favorites/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: parseInt(userId) },
      include: {
        recipe: true, // Include toate datele despre rețetă
      },
    });

    const favoriteRecipes = favorites.map(f => f.recipe);

    res.json(favoriteRecipes);
  } catch (error) {
    console.error('Error fetching favorite recipes:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Adaugă rețetă la favorite
router.post('/favorites/:recipeId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const recipeId = parseInt(req.params.recipeId);

  try {
    // Verifică dacă rețeta există
    const recipeExists = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipeExists) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Verifică dacă e deja la favorite
    const existingFavorite = await prisma.favorite.findFirst({
      where: { userId, recipeId }
    });

    if (existingFavorite) {
      return res.status(200).json({ message: 'Already in favorites' });
    }

    await prisma.favorite.create({
      data: {
        userId,
        recipeId
      }
    });

    res.status(201).json({ message: 'Recipe added to favorites' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not add to favorites' });
  }
});

// Șterge rețetă din favorite
router.delete('/favorites/:recipeId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const recipeId = parseInt(req.params.recipeId);

  try {
    await prisma.favorite.deleteMany({
      where: {
        userId,
        recipeId
      }
    });

    res.status(200).json({ message: 'Recipe removed from favorites' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not remove from favorites' });
  }
});

// Adaugă sau actualizează review și rating
router.post('/review/:recipeId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const recipeId = parseInt(req.params.recipeId);
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    const existingReview = await prisma.review.findFirst({
      where: { userId, recipeId }
    });

    if (existingReview) {
      const updated = await prisma.review.update({
        where: { id: existingReview.id },
        data: { rating, comment }
      });
      res.status(200).json(updated);
    } else {
      const created = await prisma.review.create({
        data: {
          userId,
          recipeId,
          rating,
          comment
        }
      });
      res.status(201).json(created);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not save review' });
  }
});

// Șterge review
router.delete('/review/:recipeId', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const recipeId = parseInt(req.params.recipeId);

  try {
    await prisma.review.deleteMany({
      where: {
        userId,
        recipeId
      }
    });

    res.status(200).json({ message: 'Review deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not delete review' });
  }
});

export default router;
