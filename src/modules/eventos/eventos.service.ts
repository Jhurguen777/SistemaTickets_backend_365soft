// src/modules/eventos/eventos.service.ts
import prisma from '../../shared/config/database';

// ── INTERFACES ────────────────────────────────────────────────────
export interface GetEventosFilters {
  estado?: string;
  fecha?: Date;
  ubicacion?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateEventoData {
  titulo: string;
  descripcion?: string;
  fecha: Date;
  hora: string;
  ubicacion: string;
  direccion?: string;
  imagenUrl?: string;
  capacidad: number;
  precio: number;
  categoria?: string;
  subcategoria?: string;
  organizer?: string;
  doorsOpen?: string;
  estado?: string;
  sectores?: Array<{
    nombre: string;
    precio: number;
    total: number;
  }>;
  seatMapConfig?: any;
}

export interface UpdateEventoData {
  titulo?: string;
  descripcion?: string;
  fecha?: Date;
  hora?: string;
  ubicacion?: string;
  direccion?: string;
  imagenUrl?: string;
  capacidad?: number;
  precio?: number;
  categoria?: string;
  subcategoria?: string;
  organizer?: string;
  doorsOpen?: string;
  estado?: string;
  activo?: boolean;
  seatMapConfig?: any;
  sectores?: Array<{
    nombre: string;
    precio: number;
    total: number;
    disponible: number;
  }>;
}

// ── LISTAR EVENTOS CON FILTROS ────────────────────────────────────────
export const getEventos = async (filters: GetEventosFilters) => {
  const where: any = {};

  // Filtro por estado
  if (filters.estado) {
    where.estado = filters.estado;
  }

  // Filtro por fecha (eventos desde una fecha en adelante)
  if (filters.fecha) {
    where.fecha = { gte: filters.fecha };
  }

  // Filtro por ubicación
  if (filters.ubicacion) {
    where.ubicacion = { contains: filters.ubicacion, mode: 'insensitive' };
  }

  // Búsqueda (título o descripción)
  if (filters.search) {
    where.OR = [
      { titulo: { contains: filters.search, mode: 'insensitive' } },
      { descripcion: { contains: filters.search, mode: 'insensitive' } },
      { ubicacion: { contains: filters.search, mode: 'insensitive' } },
      { categoria: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  // Paginación
  const skip = ((filters.page || 1) - 1) * (filters.limit || 10);
  const take = filters.limit || 10;

  // Obtener eventos
  const [eventos, total] = await Promise.all([
    prisma.evento.findMany({
      where,
      skip,
      take,
      orderBy: { fecha: 'asc' },
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        fecha: true,
        hora: true,
        ubicacion: true,
        direccion: true,
        imagenUrl: true,
        capacidad: true,
        precio: true,
        categoria: true,
        subcategoria: true,
        organizer: true,
        doorsOpen: true,
        estado: true,
        activo: true,
        seatMapConfig: true,
        createdAt: true,
        _count: {
          select: {
            asientos: true,
            compras: true
          }
        },
        sectores: {
          select: {
            id: true,
            nombre: true,
            precio: true,
            disponible: true,
            total: true
          }
        }
      }
    }),
    prisma.evento.count({ where })
  ]);

  return {
    eventos,
    pagination: {
      total,
      page: filters.page || 1,
      limit: filters.limit || 10,
      totalPages: Math.ceil(total / (filters.limit || 10))
    }
  };
};

// ── OBTENER EVENTO POR ID ────────────────────────────────────────────
export const getEventoById = async (id: string) => {
  const evento = await prisma.evento.findUnique({
    where: { id },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      fecha: true,
      hora: true,
      ubicacion: true,
      direccion: true,
      imagenUrl: true,
      capacidad: true,
      precio: true,
      categoria: true,
      subcategoria: true,
      organizer: true,
      doorsOpen: true,
      estado: true,
      activo: true,
      seatMapConfig: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          asientos: true,
          compras: true
        }
      },
      sectores: {
        orderBy: { precio: 'asc' }
      },
      asientos: {
        take: 10,
        orderBy: [{ fila: 'asc' }, { numero: 'asc' }]
      }
    }
  });

  return evento;
};

// ── CREAR EVENTO ───────────────────────────────────────────────────────
export const createEvento = async (data: CreateEventoData) => {
  const evento = await prisma.evento.create({
    data: {
      titulo: data.titulo,
      descripcion: data.descripcion,
      fecha: new Date(data.fecha),
      hora: data.hora,
      ubicacion: data.ubicacion,
      direccion: data.direccion,
      imagenUrl: data.imagenUrl,
      capacidad: data.capacidad,
      precio: data.precio,
      categoria: data.categoria || 'Fiestas',
      subcategoria: data.subcategoria,
      organizer: data.organizer,
      doorsOpen: data.doorsOpen,
      estado: (data.estado || 'ACTIVO') as any,
      seatMapConfig: data.seatMapConfig || null,
      sectores: data.sectores ? {
        create: data.sectores.map(sector => ({
          nombre: sector.nombre,
          precio: sector.precio,
          disponible: sector.total,
          total: sector.total
        }))
      } : undefined
    },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      fecha: true,
      hora: true,
      ubicacion: true,
      direccion: true,
      imagenUrl: true,
      capacidad: true,
      precio: true,
      categoria: true,
      subcategoria: true,
      organizer: true,
      doorsOpen: true,
      estado: true,
      seatMapConfig: true,
      createdAt: true,
      sectores: {
        select: {
          id: true,
          nombre: true,
          precio: true,
          disponible: true,
          total: true
        }
      }
    }
  });

  return evento;
};

// ── ACTUALIZAR EVENTO ─────────────────────────────────────────────────
export const updateEvento = async (id: string, data: UpdateEventoData) => {
  // Verificar que el evento existe
  const existe = await prisma.evento.findUnique({
    where: { id }
  });

  if (!existe) {
    return null;
  }

  // Si se proporcionan sectores, eliminar los anteriores y crear los nuevos
  if (data.sectores) {
    // Eliminar sectores existentes
    await prisma.sectorEvento.deleteMany({
      where: { eventoId: id }
    });
  }

  // Actualizar evento
  const evento = await prisma.evento.update({
    where: { id },
    data: {
      ...(data.titulo && { titulo: data.titulo }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      ...(data.fecha && { fecha: new Date(data.fecha) }),
      ...(data.hora && { hora: data.hora }),
      ...(data.ubicacion && { ubicacion: data.ubicacion }),
      ...(data.direccion !== undefined && { direccion: data.direccion }),
      ...(data.imagenUrl !== undefined && { imagenUrl: data.imagenUrl }),
      ...(data.capacidad && { capacidad: data.capacidad }),
      ...(data.precio && { precio: data.precio }),
      ...(data.categoria && { categoria: data.categoria }),
      ...(data.subcategoria !== undefined && { subcategoria: data.subcategoria }),
      ...(data.organizer !== undefined && { organizer: data.organizer }),
      ...(data.doorsOpen !== undefined && { doorsOpen: data.doorsOpen }),
      ...(data.estado && { estado: data.estado as any }),
      ...(data.activo !== undefined && { activo: data.activo }),
      ...(data.seatMapConfig !== undefined && { seatMapConfig: data.seatMapConfig }),
      ...(data.sectores && {
        sectores: {
          create: data.sectores.map(sector => ({
            nombre: sector.nombre,
            precio: sector.precio,
            total: sector.total,
            disponible: sector.disponible
          }))
        }
      })
    },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      fecha: true,
      hora: true,
      ubicacion: true,
      direccion: true,
      imagenUrl: true,
      capacidad: true,
      precio: true,
      categoria: true,
      subcategoria: true,
      organizer: true,
      doorsOpen: true,
      estado: true,
      activo: true,
      seatMapConfig: true,
      updatedAt: true,
      sectores: {
        select: {
          id: true,
          nombre: true,
          precio: true,
          disponible: true,
          total: true
        }
      }
    }
  });

  return evento;
};

// ── ELIMINAR EVENTO ───────────────────────────────────────────────────
export const deleteEvento = async (id: string) => {
  // Verificar que el evento existe
  const existe = await prisma.evento.findUnique({
    where: { id }
  });

  if (!existe) {
    return false;
  }

  // Eliminar evento (CASCADE eliminará asientos y compras relacionados)
  await prisma.evento.delete({
    where: { id }
  });

  return true;
};
