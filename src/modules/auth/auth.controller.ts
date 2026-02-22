// src/modules/auth/auth.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  generateAuthToken,
  completeUserProfile,
  needsProfileCompletion,
  getUserProfile,
} from './auth.service';
import prisma from '../../shared/config/database';

// ── LOGIN LOCAL (SOLO PARA DESARROLLO) ─────────────────────
export const loginLocal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email y contraseña son requeridos' });
      return;
    }

    // Credenciales hardcodeadas para desarrollo
    const ADMIN_EMAIL = 'administrador@gmail.com';
    const ADMIN_PASSWORD = 'superadmin';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      // Buscar o crear usuario admin en la base de datos
      let adminUser = await prisma.usuario.findUnique({
        where: { email: ADMIN_EMAIL }
      });

      if (!adminUser) {
        adminUser = await prisma.usuario.create({
          data: {
            email: ADMIN_EMAIL,
            nombre: 'Administrador',
            rol: 'ADMIN'
          }
        });
      }

      const token = generateAuthToken({
        id: adminUser.id,
        email: adminUser.email,
        rol: adminUser.rol
      });

      res.json({
        success: true,
        message: 'Login exitoso',
        token,
        usuario: {
          id: adminUser.id,
          email: adminUser.email,
          nombre: adminUser.nombre,
          rol: adminUser.rol
        }
      });
      return;
    }

    res.status(401).json({ error: 'Credenciales inválidas' });
  } catch (error) {
    console.error('❌ Error en loginLocal:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
};

// ── GOOGLE CALLBACK ──────────────────────────────────────────
export const googleCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Passport adjunta el usuario en req.user después de autenticar
    const usuario = req.user;

    if (!usuario) {
      res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Authentication+failed`);
      return;
    }

    const token = generateAuthToken({
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
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

    const { telefono, agencia } = req.body;

    if (!telefono || !agencia) {
      res.status(400).json({
        error: 'Datos incompletos',
        message: 'Teléfono y agencia son obligatorios'
      });
      return;
    }

    // Validar teléfono Bolivia: +591 XXXXXXXX
    const telefonoRegex = /^\+?591\s?\d{8}$/;
    if (!telefonoRegex.test(telefono.replace(/\s/g, ''))) {
      res.status(400).json({
        error: 'Teléfono inválido',
        message: 'Formato válido: +591 XXXXXXXX'
      });
      return;
    }

    const usuarioActualizado = await completeUserProfile(req.user.id, { telefono, agencia });

    const token = generateAuthToken({
      id: usuarioActualizado.id,
      email: usuarioActualizado.email,
      rol: usuarioActualizado.rol,
    });

    res.json({
      success: true,
      message: 'Perfil completado exitosamente',
      token,
      usuario: {
        id: usuarioActualizado.id,
        email: usuarioActualizado.email,
        nombre: usuarioActualizado.nombre,
        telefono: usuarioActualizado.telefono,
        agencia: usuarioActualizado.agencia,
        rol: usuarioActualizado.rol,
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

    const perfil = await getUserProfile(req.user.id);

    if (!perfil) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ success: true, usuario: perfil });
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