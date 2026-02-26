// src/modules/auth/auth.service.ts
import prisma from '../../shared/config/database';
import { generateToken } from '../../shared/utils/jwt';
import bcrypt from 'bcrypt';

export interface CompleteProfileData {
  nombre: string;
  apellido: string;
  ci: string;
  telefono: string;
  agencia: string;
}

/**
 * Generar JWT para un usuario
 * Compatible con el payload que espera tu middleware auth.ts
 */
export const generateAuthToken = (usuario: {
  id: string;
  email: string;
  rol?: string;
}) => {
  const token = generateToken({
    id: usuario.id,
    email: usuario.email,
    ...(usuario.rol && { rol: usuario.rol }),
  });

  return token;
};

/**
 * Completar perfil del usuario (apellido, telefono y agencia)
 * Se usa después del primer login con Google
 */
export const completeUserProfile = async (
  userId: string,
  data: CompleteProfileData
) => {
  try {
    const usuario = await prisma.usuario.update({
      where: { id: userId },
      data: {
        nombre: data.nombre,
        apellido: data.apellido,
        ci: data.ci,
        telefono: data.telefono,
        agencia: data.agencia,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        ci: true,
        telefono: true,
        agencia: true,
        googleId: true,
      }
    });

    return usuario;
  } catch (error) {
    console.error('❌ Error al completar perfil:', error);
    throw new Error('Error al actualizar perfil de usuario');
  }
};

/**
 * Verificar si el usuario necesita completar su perfil
 */
export const needsProfileCompletion = async (userId: string): Promise<boolean> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { apellido: true, telefono: true, agencia: true }
  });

  if (!usuario) {
    return false;
  }

  // Necesita completar si apellido, telefono o agencia están vacíos
  return !usuario.apellido || !usuario.telefono || !usuario.agencia;
};

/**
 * Obtener información del usuario autenticado
 */
export const getUserProfile = async (userId: string) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        agencia: true,
        createdAt: true,
        _count: {
          select: {
            compras: true,
            asistencias: true,
          }
        }
      }
    });

    return usuario;
  } catch (error) {
    console.error('❌ Error al obtener perfil:', error);
    throw new Error('Error al obtener información del usuario');
  }
};

/**
 * Registrar nuevo usuario local
 */
export const registerLocal = async (data: {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
}) => {
  try {
    // Verificar si el email ya existe
    const existingUser = await prisma.usuario.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Hashear la contraseña
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Crear usuario
    const usuario = await prisma.usuario.create({
      data: {
        email: data.email,
        password: hashedPassword,
        nombre: data.nombre,
        apellido: data.apellido || null,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        createdAt: true
      }
    });

    // Generar token
    const token = generateAuthToken({
      id: usuario.id,
      email: usuario.email,
    });

    return {
      usuario,
      token
    };
  } catch (error) {
    console.error('❌ Error en registro:', error);
    throw error;
  }
};