// src/modules/admin/roles.service.ts
import prisma from '../../shared/config/database';
import bcrypt from 'bcryptjs';

export interface CreateRolDTO {
  nombre: string;
  email: string;
  password: string;
  tipoRol: 'SUPER_ADMIN' | 'GESTOR_EVENTOS' | 'GESTOR_REPORTES' | 'GESTOR_ASISTENCIA' | 'GESTOR_USUARIOS';
}

export interface UpdateRolDTO {
  nombre?: string;
  email?: string;
  password?: string;
  tipoRol?: 'SUPER_ADMIN' | 'GESTOR_EVENTOS' | 'GESTOR_REPORTES' | 'GESTOR_ASISTENCIA' | 'GESTOR_USUARIOS';
  estado?: 'ACTIVO' | 'INACTIVO';
}

// Obtener todos los roles
export const getAllRoles = async () => {
  const roles = await prisma.adminRol.findMany({
    select: {
      id: true,
      nombre: true,
      email: true,
      tipoRol: true,
      estado: true,
      ultimoAcceso: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return roles;
};

// Obtener un rol por ID
export const getRolById = async (id: string) => {
  const rol = await prisma.adminRol.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      email: true,
      tipoRol: true,
      estado: true,
      ultimoAcceso: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return rol;
};

// Crear un nuevo rol
export const createRol = async (data: CreateRolDTO) => {
  const existing = await prisma.adminRol.findUnique({
    where: { email: data.email }
  });

  if (existing) {
    throw new Error('El email ya está registrado');
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const rol = await prisma.adminRol.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password: hashedPassword,
      tipoRol: data.tipoRol,
      estado: 'ACTIVO'
    },
    select: {
      id: true,
      nombre: true,
      email: true,
      tipoRol: true,
      estado: true,
      createdAt: true
    }
  });

  return rol;
};

// Actualizar un rol
export const updateRol = async (id: string, data: UpdateRolDTO) => {
  const updateData: any = { ...data };

  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10);
  }

  const rol = await prisma.adminRol.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      nombre: true,
      email: true,
      tipoRol: true,
      estado: true,
      ultimoAcceso: true,
      updatedAt: true
    }
  });

  return rol;
};

// Eliminar un rol
export const deleteRol = async (id: string) => {
  await prisma.adminRol.delete({
    where: { id }
  });
};

// Actualizar último acceso
export const updateUltimoAcceso = async (id: string) => {
  await prisma.adminRol.update({
    where: { id },
    data: { ultimoAcceso: new Date() }
  });
};