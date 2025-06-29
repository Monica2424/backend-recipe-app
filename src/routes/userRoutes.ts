import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth';

import axios from 'axios';

const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Register route
router.post('/register', async (req: Request, res: Response): Promise<Response> => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ message: 'Email, username, and password are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword
      }
    });

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(201).json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Login route
router.post('/login', async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) {
      return res.status(400).json({ message: 'Invalid credentials or Google account' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/google-login', async (req: Request, res: Response): Promise<Response> => {
    const { token: accessToken } = req.body;
  
    if (!accessToken) {
      return res.status(400).json({ message: 'Access token is required' });
    }
  
    try {
      const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
  
      const { email, name, picture } = data;
  
      if (!email) {
        return res.status(400).json({ message: 'Email not found in Google profile' });
      }
  
      let user = await prisma.user.findUnique({ where: { email } });
  
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username: name || email.split('@')[0],
            password: "", 
          },
        });
      }
  
      const jwtToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
  
      return res.status(200).json({
        token: jwtToken,
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (error) {
      console.error("Eroare Google login:", error);
      return res.status(500).json({ message: 'Google login failed' });
    }
  });
  

router.get('/auth/google', (req, res) => {
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_REDIRECT_URI}&response_type=code&scope=openid%20email%20profile&access_type=offline`;
  res.redirect(redirectUrl);
});

router.get('/auth/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    const { data } = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      },
    });

    const idToken = data.id_token;

    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      return res.status(400).send('Invalid token payload');
    }

    let user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          username: payload.email.split('@')[0],
          password: "",
        },
      });
    }

    const jwtToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });

    res.redirect(`http://localhost:5173?token=${jwtToken}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Google login failed');
  }
});
// Update username route
router.put('/update-username', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const { username } = req.body;
  const userId = (req as any).user.userId;

  if (!username || username.trim().length === 0) {
    return res.status(400).json({ message: 'Username is required' });
  }

  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ message: 'Username must be between 3 and 50 characters' });
  }

  try {
    // Check if username already exists (excluding current user)
    const existingUser = await prisma.user.findFirst({
      where: {
        username: username.trim(),
        NOT: {
          id: userId
        }
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username: username.trim() },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true
      }
    });

    return res.status(200).json({
      message: 'Username updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating username:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// Get user profile by recipe ID
router.get('/user-profile/:recipeId', async (req: Request, res: Response): Promise<Response> => {
  const { recipeId } = req.params;
  
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(recipeId) },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            _count: {
              select: {
                recipes: true,
                followers: true
              }
            }
          }
        }
      }
    });
    
    if (!recipe || !recipe.user) {
      return res.status(404).json({ message: 'Recipe or user not found' });
    }
    
    return res.status(200).json({
      userId: recipe.user.id,
      username: recipe.user.username,
      recipeCount: recipe.user._count.recipes,
      followersCount: recipe.user._count.followers,
      isSpoonacularRecipe: false
    });
    
  } catch (error) {
    console.error('Error getting user profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// Get recipe author initials
router.get('/recipe-author/:recipeId', async (req: Request, res: Response): Promise<Response> => {
  const { recipeId } = req.params;
  
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: parseInt(recipeId) },
      include: {
        user: {
          select: {
            username: true
          }
        }
      }
    });
    
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    // If recipe has an author, return initials
    if (recipe.user && recipe.user.username) {
      const initials = recipe.user.username
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2); // Max 2 letters
      
      return res.status(200).json({ 
        initials,
        isUserRecipe: true 
      });
    }
    
    // If no author (Spoonacular recipe), return 'S'
    return res.status(200).json({ 
      initials: 'S',
      isUserRecipe: false 
    });
    
  } catch (error) {
    console.error('Error getting recipe author:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Delete account route
router.delete('/delete-account', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;

  try {
    // Delete all related data first, then delete the user
    await prisma.$transaction(async (prisma) => {
      // Delete favorites
      await prisma.favorite.deleteMany({
        where: { userId: userId }
      });

      // Delete notifications
      await prisma.notification.deleteMany({
        where: { userId: userId }
      });

      // Delete follows (both as follower and following)
      await prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId },
            { followingId: userId }
          ]
        }
      });

      // Delete recipes (this will also delete related data like ingredients, instructions, etc.)
      await prisma.recipe.deleteMany({
        where: { userId: userId }
      });

      // Finally, delete the user
      await prisma.user.delete({
        where: { id: userId }
      });
    });

    return res.status(200).json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get current user info route
router.get('/profile', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// Get user by ID
router.get('/user/:userId', async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        username: true,
        createdAt: true,
        _count: {
          select: {
            recipes: true,
            followers: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json(user);
    
  } catch (error) {
    console.error('Error getting user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// Get recipes by user ID
router.get('/recipes-by-user/:userId', async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const { page = 1, limit = 12 } = req.query;
  
  try {
    const recipes = await prisma.recipe.findMany({
      where: { userId: parseInt(userId) },
      include: {
        user: {
          select: {
            username: true
          }
        },
      },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' }
    });
    
    const totalRecipes = await prisma.recipe.count({
      where: { userId: parseInt(userId) }
    });
    
    return res.status(200).json({
      recipes,
      totalPages: Math.ceil(totalRecipes / parseInt(limit as string)),
      currentPage: parseInt(page as string),
      totalRecipes
    });
    
  } catch (error) {
    console.error('Error getting user recipes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get only Spoonacular recipes (recipes without userId)
router.get('/spoonacular-recipes', async (req: Request, res: Response): Promise<Response> => {
  
  try {
    const recipes = await prisma.recipe.findMany({
      where: { userId: null },
      orderBy: { createdAt: 'desc' }
    });
    
    return res.status(200).json(recipes);
    
  } catch (error) {
    console.error('Error getting Spoonacular recipes:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});
// GET /api/users/followers - Get current user's followers
router.get('/followers', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;
  
  try {
    const followers = await prisma.follow.findMany({
      where: {
        followingId: userId
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Transform the data to match your frontend expectations
    const followersData = followers.map(follow => follow.follower);
    
    return res.status(200).json(followersData);
    
  } catch (error) {
    console.error('Error fetching followers:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/following - Get users current user is following
router.get('/following', authenticateToken, async (req: Request, res: Response): Promise<Response> => {
  const userId = (req as any).user.userId;
  
  try {
    const following = await prisma.follow.findMany({
      where: {
        followerId: userId
      },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Transform the data to match your frontend expectations
    const followingData = following.map(follow => follow.following);
    
    return res.status(200).json(followingData);
    
  } catch (error) {
    console.error('Error fetching following:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


export default router;
