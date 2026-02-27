// src/shared/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tipoRol?: string;
    isAdmin: boolean;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'No autorizado - Token no proporcionado' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };

    // Primero buscar en la tabla de roles (administradores)
    const rol = await prisma.adminRol.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, tipoRol: true, estado: true }
    });

    if (rol) {
      if (rol.estado !== 'ACTIVO') {
        res.status(403).json({ error: 'Cuenta de administrador inactiva' });
        return;
      }

      req.user = {
        id: rol.id,
        email: rol.email,
        tipoRol: rol.tipoRol,
        isAdmin: true
      };

      next();
      return;
    }

    // Si no es rol, buscar en usuarios normales
    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, nombre: true, telefono: true, agencia: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Usuario no encontrado' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      isAdmin: false
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
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'No autorizado - Debe estar autenticado' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Acceso denegado - Se requiere rol de administrador' });
    return;
  }

  next();
};

// Middleware para verificar roles específicos
export const hasRole = (...allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado - Se requiere rol de administrador' });
      return;
    }

    if (req.user.tipoRol === 'SUPER_ADMIN') {
      next();
      return;
    }

    if (!allowedRoles.includes(req.user.tipoRol || '')) {
      res.status(403).json({ error: 'Acceso denegado - Permisos insuficientes' });
      return;
    }

    next();
  };
};