// src/modules/auth/auth.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  generateAuthToken,
  completeUserProfile,
  needsProfileCompletion,
  getUserProfile,
  registerLocal as registerUserService,
} from './auth.service';
import prisma from '../../shared/config/database';

// ── REGISTRO LOCAL ────────────────────────────────────────────
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, nombre, apellido } = req.body;

    if (!email || !password || !nombre) {
      res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Email inválido' });
      return;
    }

    const result = await registerUserService({ email, password, nombre, apellido });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token: result.token,
      usuario: result.usuario
    });
  } catch (error: any) {
    console.error('❌ Error en registro:', error);

    if (error.message === 'El email ya está registrado') {
      res.status(409).json({ error: 'El email ya está registrado' });
      return;
    }

    res.status(500).json({ error: error.message || 'Error al registrar usuario' });
  }
};

// ── LOGIN LOCAL ─────────────────────────────────────────────
export const loginLocal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son requeridos' });
      return;
    }

    const bcrypt = require('bcryptjs');

    // 1️⃣ Buscar en AdminRol
    const adminUser = await prisma.adminRol.findUnique({ where: { email } });

    if (adminUser) {
      const passwordMatch = await bcrypt.compare(password, adminUser.password);
      if (!passwordMatch) {
        res.status(401).json({ error: 'Credenciales inválidas' });
        return;
      }

      if (adminUser.estado !== 'ACTIVO') {
        res.status(403).json({ error: 'Cuenta de administrador inactiva' });
        return;
      }

      await prisma.adminRol.update({
        where: { id: adminUser.id },
        data: { ultimoAcceso: new Date() }
      });

      const token = generateAuthToken({
        id:    adminUser.id,
        email: adminUser.email,
        rol:   adminUser.tipoRol
      });

      res.json({
        success: true,
        message: 'Login exitoso',
        token,
        usuario: {
          id:      adminUser.id,
          email:   adminUser.email,
          nombre:  adminUser.nombre,
          tipoRol: adminUser.tipoRol,
          isAdmin: true
        }
      });
      return;
    }

    // 2️⃣ Buscar en usuarios normales — ahora trae el campo `rol`
    const normalUser = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id:       true,
        email:    true,
        nombre:   true,
        password: true,
        activo:   true,
        rol:      true,   // ← AGREGADO: necesario para detectar ADMIN
      }
    });

    if (!normalUser || !normalUser.password) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, normalUser.password);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    if (!normalUser.activo) {
      res.status(403).json({ error: 'Cuenta inactiva' });
      return;
    }

    const isAdmin = normalUser.rol === 'ADMIN'; // ← AGREGADO

    const token = generateAuthToken({
      id:    normalUser.id,
      email: normalUser.email,
      ...(isAdmin && { rol: normalUser.rol }) // ← incluir rol en el token si es admin
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario: {
        id:      normalUser.id,
        email:   normalUser.email,
        nombre:  normalUser.nombre,
        rol:     normalUser.rol,
        isAdmin: isAdmin  // ← CORREGIDO: ya no es siempre false
      }
    });
  } catch (error) {
    console.error('❌ Error en loginLocal:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

// ── GOOGLE CALLBACK ──────────────────────────────────────────
export const googleCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuario = req.user;

    if (!usuario) {
      res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Authentication+failed`);
      return;
    }

    const token = generateAuthToken({
      id:    usuario.id,
      email: usuario.email,
    });

    const needsCompletion = await needsProfileCompletion(usuario.id);

    const redirectUrl = needsCompletion
      ? `${process.env.FRONTEND_URL}/auth/complete-profile?token=${token}`
      : `${process.env.FRONTEND_URL}/auth/success?token=${token}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Error en googleCallback:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Server+error`);
  }
};

// ── COMPLETE PROFILE ─────────────────────────────────────────
export const completeProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const { nombre, apellido, ci, telefono, agencia } = req.body;

    if (!nombre || !apellido || !ci || !telefono || !agencia) {
      res.status(400).json({
        error: 'Datos incompletos',
        message: 'Nombre, apellido, CI, teléfono y agencia son obligatorios'
      });
      return;
    }

    const usuarioActualizado = await completeUserProfile(req.user.id, { nombre, apellido, ci, telefono, agencia });

    const token = generateAuthToken({
      id:    usuarioActualizado.id,
      email: usuarioActualizado.email,
    });

    res.json({
      success: true,
      message: 'Perfil completado exitosamente',
      token,
      usuario: {
        id:       usuarioActualizado.id,
        email:    usuarioActualizado.email,
        nombre:   usuarioActualizado.nombre,
        apellido: usuarioActualizado.apellido,
        ci:       usuarioActualizado.ci,
        telefono: usuarioActualizado.telefono,
        agencia:  usuarioActualizado.agencia,
      }
    });
  } catch (error) {
    console.error('❌ Error al completar perfil:', error);
    res.status(500).json({ error: 'Error al completar el perfil' });
  }
};

// ── GET ME ───────────────────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // 1️⃣ Si es admin de tabla AdminRol
    if (req.user.isAdmin && req.user.tipoRol) {
      const admin = await prisma.adminRol.findUnique({
        where: { id: req.user.id },
        select: {
          id:           true,
          email:        true,
          nombre:       true,
          tipoRol:      true,
          estado:       true,
          ultimoAcceso: true,
          createdAt:    true,
        }
      });

      if (admin) {
        res.json({
          success: true,
          usuario: { ...admin, isAdmin: true }
        });
        return;
      }
    }

    // 2️⃣ Usuario normal (incluyendo usuarios con rol ADMIN en tabla usuarios)
    const perfil = await getUserProfile(req.user.id);

    if (!perfil) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({
      success: true,
      usuario: { ...perfil, isAdmin: req.user.isAdmin }  // ← respeta el isAdmin del token
    });
  } catch (error) {
    console.error('❌ Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

// ── LOGOUT ───────────────────────────────────────────────────
export const logout = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Sesión cerrada — elimina el token en el frontend'
  });
};