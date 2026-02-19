// src/shared/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: Express.User;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {  // ← tipo de retorno explícito
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'No autorizado - Token no proporcionado' });
      return;  // ← return sin valor después de res
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };

    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, rol: true, nombre: true, telefono: true, agencia: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Usuario no encontrado' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      rol: user.rol,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    res.status(401).json({ error: 'Token inválido' });
  }
};

export const adminOnly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {  // ← tipo de retorno explícito
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado - Debe estar autenticado' });
    return;
  }

  if (req.user.rol !== 'ADMIN') {
    res.status(403).json({ error: 'Acceso denegado - Se requiere rol de admin' });
    return;
  }

  next();
};