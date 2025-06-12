import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// Tipăm explicit userul pentru a putea accesa `req.user`
export interface AuthenticatedRequest extends Request {
  user?: { userId: number, email?: string };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1]; // format: Bearer <token>
  console.log("Authorization header:", authHeader);
console.log("Token extras:", token);


  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number, email?: string };
    console.log("TOKEN DECODAT:", decoded);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};
