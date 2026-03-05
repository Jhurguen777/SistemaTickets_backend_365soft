import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';

// ✅ Declaración global — hace que Express reconozca el tipo user correcto.
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      nombre?: string;
      apellido?: string;
      tipoRol?: string;
      isAdmin: boolean;
    }
  }
}

export interface AuthRequest extends Request {
  user?: Express.User;
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    // Log para depuración de peticiones
    if (req.path.includes('/qr/verificar') || req.path.includes('/verificar-pago')) {
      console.log('🔐 Middleware authenticate:', {
        method: req.method,
        path: req.path,
        query: req.query,
        hasToken: !!token
      });
    }
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
        id:      rol.id,
        email:   rol.email,
        tipoRol: rol.tipoRol,
        isAdmin: true
      };
      console.log('✅ Usuario administrador autenticado:', { id: rol.id, email: rol.email });
      next();
      return;
    }

    const user = await prisma.usuario.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, nombre: true, apellido: true, rol: true, activo: true }
    });

    if (!user) {
      console.error('❌ Usuario no encontrado en BD:', decoded.id);
      res.status(401).json({ error: 'Usuario no encontrado' });
      return;
    }

    if (!user.activo) {
      console.error('❌ Cuenta inactiva:', { id: user.id, email: user.email });
      res.status(403).json({ error: 'Cuenta inactiva' });
      return;
    }

    req.user = {
      id:       user.id,
      email:    user.email,
      nombre:   user.nombre || undefined,
      apellido: user.apellido || undefined,
      isAdmin:  user.rol === 'ADMIN'
    };
    console.log('✅ Usuario autenticado:', { id: user.id, email: user.email, isAdmin: user.rol === 'ADMIN' });
    next();

  } catch (error: any) {
    console.error('❌ Error en middleware authenticate:', {
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack
    });

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    res.status(401).json({ error: 'Token inválido' });
  }
};

export const adminOnly = async (
  req: Request,
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

export const hasRole = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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