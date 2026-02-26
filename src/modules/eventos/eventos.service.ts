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

  if (filters.estado) where.estado = filters.estado;
  if (filters.fecha)  where.fecha  = { gte: filters.fecha };
  if (filters.ubicacion) {
    where.ubicacion = { contains: filters.ubicacion, mode: 'insensitive' };
  }
  if (filters.search) {
    where.OR = [
      { titulo:      { contains: filters.search, mode: 'insensitive' } },
      { descripcion: { contains: filters.search, mode: 'insensitive' } },
      { ubicacion:   { contains: filters.search, mode: 'insensitive' } },
      { categoria:   { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  const skip = ((filters.page || 1) - 1) * (filters.limit || 10);
  const take = filters.limit || 10;

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
        _count: { select: { asientos: true, compras: true } },
        sectores: {
          select: { id: true, nombre: true, precio: true, disponible: true, total: true }
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
  return prisma.evento.findUnique({
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
      _count: { select: { asientos: true, compras: true } },
      sectores: { orderBy: { precio: 'asc' } },
      asientos: {
        take: 10,
        orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
        select: {
          id: true,
          fila: true,
          numero: true,
          precio: true,   // ✅ precio individual
          estado: true
        }
      }
    }
  });
};

// ── CREAR EVENTO ───────────────────────────────────────────────────────
export const createEvento = async (data: CreateEventoData) => {
  return prisma.evento.create({
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
        create: data.sectores.map(s => ({
          nombre: s.nombre,
          precio: s.precio,
          disponible: s.total,
          total: s.total
        }))
      } : undefined
    },
    select: {
      id: true, titulo: true, descripcion: true, fecha: true,
      hora: true, ubicacion: true, direccion: true, imagenUrl: true,
      capacidad: true, precio: true, categoria: true, subcategoria: true,
      organizer: true, doorsOpen: true, estado: true, seatMapConfig: true,
      createdAt: true,
      sectores: {
        select: { id: true, nombre: true, precio: true, disponible: true, total: true }
      }
    }
  });
};

// ── HELPER: precio efectivo de un asiento ────────────────────────────
// Jerarquía: specialSeat.price > precio del sector > precio del evento
const resolverPrecio = (
  specialSeatPrice: number | undefined,
  sectorPrecio: number | undefined,
  eventoPrecio: number
): number => {
  if (specialSeatPrice != null && specialSeatPrice > 0) return specialSeatPrice;
  if (sectorPrecio     != null && sectorPrecio     > 0) return sectorPrecio;
  return eventoPrecio;
};

// ── ACTUALIZAR EVENTO ─────────────────────────────────────────────────
export const updateEvento = async (id: string, data: UpdateEventoData) => {
  const existe = await prisma.evento.findUnique({ where: { id } });
  if (!existe) return null;

  // Limpiar sectores y asientos anteriores si vienen sectores nuevos
  if (data.sectores !== undefined) {
    await prisma.sectorEvento.deleteMany({ where: { eventoId: id } });
    await prisma.asiento.deleteMany({ where: { eventoId: id } });
  }

  // Actualizar evento + re-crear sectores
  const evento = await prisma.evento.update({
    where: { id },
    data: {
      ...(data.titulo                       && { titulo: data.titulo }),
      ...(data.descripcion    !== undefined && { descripcion: data.descripcion }),
      ...(data.fecha                        && { fecha: new Date(data.fecha) }),
      ...(data.hora                         && { hora: data.hora }),
      ...(data.ubicacion                    && { ubicacion: data.ubicacion }),
      ...(data.direccion      !== undefined && { direccion: data.direccion }),
      ...(data.imagenUrl      !== undefined && { imagenUrl: data.imagenUrl }),
      ...(data.capacidad                    && { capacidad: data.capacidad }),
      ...(data.precio                       && { precio: data.precio }),
      ...(data.categoria                    && { categoria: data.categoria }),
      ...(data.subcategoria   !== undefined && { subcategoria: data.subcategoria }),
      ...(data.organizer      !== undefined && { organizer: data.organizer }),
      ...(data.doorsOpen      !== undefined && { doorsOpen: data.doorsOpen }),
      ...(data.estado                       && { estado: data.estado as any }),
      ...(data.activo         !== undefined && { activo: data.activo }),
      ...(data.permitirMultiplesAsientos !== undefined && { permitirMultiplesAsientos: data.permitirMultiplesAsientos }),
      ...(data.limiteAsientosPorUsuario  !== undefined && { limiteAsientosPorUsuario: data.limiteAsientosPorUsuario }),
      ...(data.seatMapConfig  !== undefined && { seatMapConfig: data.seatMapConfig }),
      ...(data.sectores && {
        sectores: {
          create: data.sectores.map(s => ({
            nombre: s.nombre,
            precio: s.precio,
            total: s.total,
            disponible: s.disponible
          }))
        }
      })
    },
    select: {
      id: true, titulo: true, descripcion: true, fecha: true,
      hora: true, ubicacion: true, direccion: true, imagenUrl: true,
      capacidad: true, precio: true, categoria: true, subcategoria: true,
      organizer: true, doorsOpen: true, estado: true, activo: true,
      seatMapConfig: true, updatedAt: true,
      sectores: {
        select: { id: true, nombre: true, precio: true, disponible: true, total: true }
      }
    }
  });

  // ── CREAR ASIENTOS DESDE EL SEAT MAP CON PRECIO INDIVIDUAL ───────
  if (data.seatMapConfig) {
    const config = data.seatMapConfig as any;
    const rows: any[] = config.rows || [];

    if (rows.length > 0) {
      // Limpiar asientos existentes antes de re-crear
      await prisma.asiento.deleteMany({ where: { eventoId: id } });

      // Mapa: sectorId-del-config → precio del sector recién creado en BD
      const sectorPrecioMap = new Map<string, number>();
      for (const configSector of config.sectors || []) {
        const sectorBD = evento.sectores.find(s => s.nombre === configSector.name);
        if (sectorBD) {
          sectorPrecioMap.set(configSector.id, sectorBD.precio);
        }
      }

      const asientosACrear: Array<{
        fila:     string;
        numero:   number;
        precio:   number;
        estado:   'DISPONIBLE' | 'RESERVANDO' | 'VENDIDO' | 'BLOQUEADO';
        eventoId: string;
      }> = [];

      for (const row of rows) {
        const totalSeats: number = typeof row.seats === 'number' ? row.seats : 0;
        // Precio base de la fila = precio del sector al que pertenece
        const sectorPrecioFila = sectorPrecioMap.get(row.sectorId);

        for (let i = 0; i < totalSeats; i++) {
          const specialSeat = config.specialSeats?.find(
            (s: any) => s.rowId === row.id && s.seatIndex === i
          );

          // Estado del asiento
          let estado: 'DISPONIBLE' | 'RESERVANDO' | 'VENDIDO' | 'BLOQUEADO' = 'DISPONIBLE';
          if (specialSeat?.status === 'sold')          estado = 'VENDIDO';
          else if (specialSeat?.status === 'reserved') estado = 'RESERVANDO';
          else if (specialSeat?.status === 'blocked')  estado = 'BLOQUEADO';

          // ✅ Precio individual: specialSeat.price > sector > evento
          const precio = resolverPrecio(
            specialSeat?.price,
            sectorPrecioFila,
            existe.precio
          );

          asientosACrear.push({
            fila:     row.name,
            numero:   i + 1,
            precio,
            estado,
            eventoId: id
          });
        }
      }

      if (asientosACrear.length > 0) {
        await prisma.asiento.createMany({
          data: asientosACrear,
          skipDuplicates: true
        });
        console.log(`✅ ${asientosACrear.length} asientos creados para el evento ${id}`);
      }
    }
  }

  return evento;
};

// ── ELIMINAR EVENTO ───────────────────────────────────────────────────
export const deleteEvento = async (id: string) => {
  const existe = await prisma.evento.findUnique({ where: { id } });
  if (!existe) return false;

  await prisma.evento.delete({ where: { id } });
  return true;
};