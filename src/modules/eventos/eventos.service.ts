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
  permitirMultiplesAsientos?: boolean;
  limiteAsientosPorUsuario?: number;
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
  permitirMultiplesAsientos?: boolean;
  limiteAsientosPorUsuario?: number;
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
      permitirMultiplesAsientos: data.permitirMultiplesAsientos || false,
      limiteAsientosPorUsuario: data.limiteAsientosPorUsuario || 1,
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
    // Eliminar sectores existentes y también los asientos
    await prisma.sectorEvento.deleteMany({
      where: { eventoId: id }
    });

    // Eliminar todos los asientos del evento
    await prisma.asiento.deleteMany({
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
      ...(data.permitirMultiplesAsientos !== undefined && { permitirMultiplesAsientos: data.permitirMultiplesAsientos }),
      ...(data.limiteAsientosPorUsuario !== undefined && { limiteAsientosPorUsuario: data.limiteAsientosPorUsuario }),
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

  // Si se proporcionó seatMapConfig, crear los asientos individuales
  if (data.seatMapConfig && data.sectores) {
    const config = data.seatMapConfig as any;
    const sectoresCreados = evento.sectores;

    // Mapear sectores por su nombre para obtener el ID
    const sectoresMap = new Map();
    sectoresCreados.forEach(sector => {
      const configSector = config.sectors.find((s: any) => s.name === sector.nombre);
      if (configSector) {
        sectoresMap.set(configSector.id, sector.id);
      }
    });

    // Crear asientos para cada fila
    const asientosACrear: Array<{
      fila: string;
      numero: number;
      precio: number;
      estado: 'DISPONIBLE' | 'RESERVANDO' | 'VENDIDO' | 'BLOQUEADO';
      sectorId: string;
      eventoId: string;
    }> = [];

    // Procesar filas
    for (const row of config.rows || []) {
      const sectorIdConfig = row.sectorId;
      const sectorIdReal = sectoresMap.get(sectorIdConfig);

      if (!sectorIdReal) continue;

      // Crear asientos para esta fila
      for (let i = 0; i < row.seats; i++) {
        // El número es un entero secuencial (1, 2, 3...)
        const numeroAsiento = i + 1;

        // Verificar si hay un asiento especial para este asiento
        const specialSeat = config.specialSeats?.find((s: any) =>
          s.rowId === row.id && s.seatIndex === i
        );

        // Obtener precio del asiento especial o del sector
        const precio = specialSeat?.price || sectoresCreados.find(s => s.id === sectorIdReal)?.precio || evento.precio;

        // Obtener estado del asiento especial o por defecto DISPONIBLE
        let estado: 'DISPONIBLE' | 'RESERVANDO' | 'VENDIDO' | 'BLOQUEADO' = 'DISPONIBLE';
        if (specialSeat?.status === 'sold') estado = 'VENDIDO';
        else if (specialSeat?.status === 'reserved') estado = 'RESERVANDO';

        asientosACrear.push({
          fila: row.name,
          numero: numeroAsiento,
          precio,
          estado,
          sectorId: sectorIdReal,
          eventoId: id
        });
      }
    }

    // Crear todos los asientos en lote
    if (asientosACrear.length > 0) {
      await prisma.asiento.createMany({
        data: asientosACrear,
        skipDuplicates: true
      });

      console.log(`✅ Creados ${asientosACrear.length} asientos para el evento ${id}`);
    }
  }

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
