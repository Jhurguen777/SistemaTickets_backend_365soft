// src/modules/admin/roles.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import {
  getAllRoles,
  getRolById,
  createRol,
  updateRol,
  deleteRol,
  promoverUsuario,
  CreateRolDTO,
  UpdateRolDTO
} from './roles.service';
import { logActividad } from './logs.service';

// Obtener todos los roles (administradores)
export const getRoles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const roles = await getAllRoles();

    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('❌ Error al obtener roles:', error);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
};

// Obtener un rol por ID
export const getRol = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { id } = req.params;

    const rol = await getRolById(id);

    if (!rol) {
      res.status(404).json({ error: 'Rol no encontrado' });
      return;
    }

    res.json({
      success: true,
      data: rol
    });
  } catch (error) {
    console.error('❌ Error al obtener rol:', error);
    res.status(500).json({ error: 'Error al obtener rol' });
  }
};

// Crear un nuevo rol
export const postCreateRol = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const data: CreateRolDTO = req.body;

    // Validaciones básicas
    if (!data.nombre || !data.email || !data.password || !data.tipoRol) {
      res.status(400).json({ error: 'Faltan campos requeridos' });
      return;
    }

    const rol = await createRol(data);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'desconocida';
    await logActividad({ adminId: req.user.id, adminNombre: req.user.nombre || req.user.email, accion: 'CREAR_ADMIN', detalles: `Creó administrador "${data.nombre}" con rol ${data.tipoRol}`, ip });

    res.status(201).json({
      success: true,
      data: rol,
      message: 'Rol creado exitosamente'
    });
  } catch (error: any) {
    console.error('❌ Error al crear rol:', error);

    if (error.message === 'El email ya está registrado') {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Error al crear rol' });
  }
};

// Actualizar un rol
export const putUpdateRol = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { id } = req.params;
    const data: UpdateRolDTO = req.body;

    const rol = await updateRol(id, data);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'desconocida';
    await logActividad({ adminId: req.user.id, adminNombre: req.user.nombre || req.user.email, accion: 'MODIFICAR_ADMIN', detalles: `Modificó administrador "${rol.nombre}"${data.tipoRol ? ` → rol ${data.tipoRol}` : ''}${data.estado ? ` → estado ${data.estado}` : ''}`, ip });

    res.json({
      success: true,
      data: rol,
      message: 'Rol actualizado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al actualizar rol:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
};

// Promover usuario existente asignándole un rol de administrador
export const postPromoverUsuario = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { usuarioId, tipoRol } = req.body;

    if (!usuarioId || !tipoRol) {
      res.status(400).json({ error: 'Faltan campos requeridos: usuarioId, tipoRol' });
      return;
    }

    const rol = await promoverUsuario(usuarioId, tipoRol);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'desconocida';
    await logActividad({ adminId: req.user.id, adminNombre: req.user.nombre || req.user.email, accion: 'ASIGNAR_ROL', detalles: `Asignó rol ${tipoRol} al usuario "${rol.nombre}" (${rol.email})`, ip });

    res.status(201).json({
      success: true,
      data: rol,
      message: 'Rol asignado exitosamente'
    });
  } catch (error: any) {
    console.error('❌ Error al promover usuario:', error);
    res.status(400).json({ error: error.message || 'Error al asignar rol' });
  }
};

// Eliminar un rol
export const deleteRolHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.isAdmin) {
      res.status(403).json({ error: 'Acceso denegado' });
      return;
    }

    const { id } = req.params;

    const rolAEliminar = await getRolById(id);
    await deleteRol(id);

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'desconocida';
    if (rolAEliminar) {
      await logActividad({ adminId: req.user.id, adminNombre: req.user.nombre || req.user.email, accion: 'ELIMINAR_ADMIN', detalles: `Eliminó administrador "${rolAEliminar.nombre}" (${rolAEliminar.email})`, ip });
    }

    res.json({
      success: true,
      message: 'Rol eliminado exitosamente'
    });
  } catch (error) {
    console.error('❌ Error al eliminar rol:', error);
    res.status(500).json({ error: 'Error al eliminar rol' });
  }
};
