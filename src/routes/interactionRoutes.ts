import express, { Request, Response } from 'express';
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



// Follow user
router.post('/follow/:userId', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const followerId = (req as any).user.userId;
  const targetUserId = parseInt(userId);
  
  if (followerId === targetUserId) {
    return res.status(400).json({ message: 'You cannot follow yourself' });
  }
  
  try {
    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: targetUserId
        }
      }
    });
    
    if (existingFollow) {
      return res.status(400).json({ message: 'Already following this user' });
    }
    
    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { username: true }
    });

    // Create follow relationship
    await prisma.follow.create({
      data: {
        followerId: followerId,
        followingId: targetUserId
      }
    });
    
    // Create notification for the followed user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        message: `${follower?.username} started following you!`,
        isRead: false,
      }
    });
    
    return res.status(201).json({ message: 'Successfully followed user' });
    
  } catch (error) {
    console.error('Error following user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Check if following user
router.get('/is-following/:userId', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const followerId = (req as any).user.userId;
  
  try {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: parseInt(userId)
        }
      }
    });
    
    return res.status(200).json({ isFollowing: !!follow });
    
  } catch (error) {
    console.error('Error checking follow status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// GET /api/notifications - Obține toate notificările utilizatorului
router.get('/notifications', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;
  
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // limitează la ultimele 50 de notificări
    });
    
    return res.status(200).json(notifications);
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/notifications/unread-count - Obține numărul de notificări necitite
router.get('/notifications/unread-count', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;
  
  try {
    const unreadCount = await prisma.notification.count({
      where: {
        userId: userId,
        isRead: false
      }
    });
    
    return res.status(200).json({ count: unreadCount });
    
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/notifications/mark-read - Marchează notificările ca citite
router.put('/notifications/mark-read', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;
  const { notificationIds } = req.body; // array de ID-uri sau null pentru toate
  
  try {
    if (notificationIds && Array.isArray(notificationIds)) {
      // Marchează notificările specifice ca citite
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: userId
        },
        data: {
          isRead: true
        }
      });
    } else {
      // Marchează toate notificările ca citite
      await prisma.notification.updateMany({
        where: {
          userId: userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });
    }
    
    return res.status(200).json({ message: 'Notifications marked as read' });
    
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/notifications/:id - Șterge o notificare
router.delete('/notifications/:id', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const userId = (req as any).user.userId;
  const notificationId = parseInt(id);
  
  try {
    // Verifică dacă notificarea aparține utilizatorului
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: userId
      }
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    await prisma.notification.delete({
      where: {
        id: notificationId
      }
    });
    
    return res.status(200).json({ message: 'Notification deleted' });
    
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/interactions/unfollow/:userId - Unfollow a user
router.delete('/unfollow/:userId', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const followerId = (req as any).user.userId;
  
  try {
    const followingId = parseInt(userId);
    
    // Check if follow relationship exists
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: followingId
        }
      }
    });
    
    if (!existingFollow) {
      return res.status(400).json({ message: 'Nu urmărești acest utilizator' });
    }
    
    // Remove follow relationship
    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: followingId
        }
      }
    });
    
    return res.status(200).json({ message: 'Utilizator anulat din urmărire cu succes' });
    
  } catch (error) {
    console.error('Error unfollowing user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/interactions/is-following/:userId - Check if following a user
router.get('/is-following/:userId', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const followerId = (req as any).user.userId;
  
  try {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: followerId,
          followingId: parseInt(userId)
        }
      }
    });
    
    return res.status(200).json({ isFollowing: !!follow });
    
  } catch (error) {
    console.error('Error checking follow status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/followers/count - Get current user's followers count
router.get('/followers/count', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;
  
  try {
    const count = await prisma.follow.count({
      where: {
        followingId: userId
      }
    });
    
    return res.status(200).json({ count });
    
  } catch (error) {
    console.error('Error fetching followers count:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/following/count - Get current user's following count
router.get('/following/count', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;
  
  try {
    const count = await prisma.follow.count({
      where: {
        followerId: userId
      }
    });
    
    return res.status(200).json({ count });
    
  } catch (error) {
    console.error('Error fetching following count:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/followers/count - Get specific user's followers count
router.get('/:userId/followers/count', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  
  try {
    const count = await prisma.follow.count({
      where: {
        followingId: parseInt(userId)
      }
    });
    
    return res.status(200).json({ count });
    
  } catch (error) {
    console.error('Error fetching user followers count:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:userId/following/count - Get specific user's following count
router.get('/:userId/following/count', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  
  try {
    const count = await prisma.follow.count({
      where: {
        followerId: parseInt(userId)
      }
    });
    
    return res.status(200).json({ count });
    
  } catch (error) {
    console.error('Error fetching user following count:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


export default router;

