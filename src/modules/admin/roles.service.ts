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
  // Verificar si el email ya existe
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

// Promover usuario existente a admin asignándole un rol
export const promoverUsuario = async (
  usuarioId: string,
  tipoRol: 'SUPER_ADMIN' | 'GESTOR_EVENTOS' | 'GESTOR_REPORTES' | 'GESTOR_ASISTENCIA' | 'GESTOR_USUARIOS'
) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, nombre: true, apellido: true, email: true, password: true, activo: true }
  });

  if (!usuario) throw new Error('Usuario no encontrado');
  if (!usuario.activo) throw new Error('El usuario está inactivo');
  if (!usuario.password) throw new Error('Esta cuenta se registró con Google y no puede acceder al panel admin. Usa "Crear Administrador" para crearle una cuenta separada.');

  const existing = await prisma.adminRol.findUnique({ where: { email: usuario.email } });

  if (existing) {
    return await prisma.adminRol.update({
      where: { email: usuario.email },
      data: { tipoRol, estado: 'ACTIVO' },
      select: { id: true, nombre: true, email: true, tipoRol: true, estado: true, createdAt: true }
    });
  }

  const nombreCompleto = usuario.apellido ? `${usuario.nombre} ${usuario.apellido}` : usuario.nombre;
  return await prisma.adminRol.create({
    data: {
      nombre: nombreCompleto,
      email: usuario.email,
      password: usuario.password,
      tipoRol,
      estado: 'ACTIVO'
    },
    select: { id: true, nombre: true, email: true, tipoRol: true, estado: true, createdAt: true }
  });
};

// Actualizar último acceso
export const updateUltimoAcceso = async (id: string) => {
  await prisma.adminRol.update({
    where: { id },
    data: { ultimoAcceso: new Date() }
  });
};