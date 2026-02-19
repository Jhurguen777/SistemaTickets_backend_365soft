// src/modules/auth/auth.service.ts
import prisma from '../../shared/config/database';
import { generateToken } from '../../shared/utils/jwt';

export interface CompleteProfileData {
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
  rol: string;
}) => {
  const token = generateToken({
    id: usuario.id,        // Usar 'id' (no 'userId') para compatibilidad
    email: usuario.email,
    rol: usuario.rol,
  });

  return token;
};

/**
 * Completar perfil del usuario (telefono y agencia)
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
        telefono: data.telefono,
        agencia: data.agencia,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        telefono: true,
        agencia: true,
        rol: true,
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
    select: { telefono: true, agencia: true }
  });

  if (!usuario) {
    return false;
  }

  // Necesita completar si telefono o agencia están vacíos
  return !usuario.telefono || !usuario.agencia;
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
        telefono: true,
        agencia: true,
        rol: true,
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