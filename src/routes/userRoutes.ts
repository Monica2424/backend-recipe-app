import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
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

export default router;
