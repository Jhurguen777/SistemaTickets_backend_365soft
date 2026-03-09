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
  modo?: 'ASIENTOS' | 'CANTIDAD';
  permitirMultiplesAsientos?: boolean;
  limiteAsientosPorUsuario?: number;
  sectores?: Array<{
    nombre: string;
    precio: number;
    total: number;
    disponible?: number;
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
  modo?: 'ASIENTOS' | 'CANTIDAD';
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
        modo: true,          // ← agregado
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
      modo: true,          // ← agregado
      createdAt: true,
      updatedAt: true,
      _count: { select: { asientos: true, compras: true } },
      sectores: { orderBy: { precio: 'asc' } },
      asientos: {
        orderBy: [{ fila: 'asc' }, { numero: 'asc' }],
        select: {
          id: true,
          fila: true,
          numero: true,
          precio: true,
          estado: true
        }
      }
    }
  });
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
      modo: (data.modo || 'ASIENTOS') as any,   // ← agregado
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
      modo: true,        // ← agregado
      createdAt: true,
      sectores: {
        select: { id: true, nombre: true, precio: true, disponible: true, total: true }
      }
    }
  });

  // ✅ Crear asientos si se proporciona seatMapConfig
  if (data.seatMapConfig) {
    const config = data.seatMapConfig;
    const rows: any[] = config.rows || [];

    if (rows.length > 0) {
      const sectoresBD = await prisma.sectorEvento.findMany({
        where: { eventoId: evento.id },
        select: { id: true, nombre: true, precio: true }
      });

      const sectorPrecioMap = new Map<string, number>();
      for (const configSector of config.sectors || []) {
        const sectorBD = sectoresBD.find(
          s => s.nombre.trim().toLowerCase() === configSector.name.trim().toLowerCase()
        );
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

      const sortedRows = [...rows].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      for (const row of sortedRows) {
        const totalSeats: number = typeof row.seats === 'number' ? row.seats : 0;
        const sectorPrecioFila = sectorPrecioMap.get(row.sectorId);

        for (let i = 0; i < totalSeats; i++) {
          const specialSeat = config.specialSeats?.find(
            (s: any) => s.rowId === row.id && s.seatIndex === i
          );

          let estado: 'DISPONIBLE' | 'RESERVANDO' | 'VENDIDO' | 'BLOQUEADO' = 'DISPONIBLE';
          if (specialSeat?.status === 'sold')          estado = 'VENDIDO';
          else if (specialSeat?.status === 'reserved') estado = 'RESERVANDO';
          else if (specialSeat?.status === 'blocked')  estado = 'BLOQUEADO';

          const precio = resolverPrecio(
            specialSeat?.price,
            sectorPrecioFila,
            data.precio
          );

          asientosACrear.push({
            fila:     row.name,
            numero:   i + 1,
            precio,
            estado,
            eventoId: evento.id
          });
        }
      }

      if (asientosACrear.length > 0) {
        console.log('═════════════════════════════════');
        console.log('📋 ASIENTOS A CREAR PARA EVENTO:', evento.id);
        console.log('📋 Total de asientos a crear:', asientosACrear.length);
        console.log('═══════════════════════════════════');

        await prisma.asiento.createMany({
          data: asientosACrear,
          skipDuplicates: true
        });
        console.log(`✅ ${asientosACrear.length} asientos creados para el evento ${evento.id}`);
      }
    }
  }

  return evento;
};

// ── HELPER: precio efectivo de un asiento ────────────────────────────
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
  console.log('🔧 updateEvento service - Recibiendo:', {
    id,
    tieneSeatMapConfig: !!data.seatMapConfig,
    tieneSectores: !!data.sectores,
    sectoresLength: data.sectores?.length || 0
  });

  const existe = await prisma.evento.findUnique({
    where: { id },
    select: { precio: true }
  });
  if (!existe) return null;

  if (data.seatMapConfig) {
    await prisma.asiento.deleteMany({ where: { eventoId: id } });
  }

  if (data.sectores !== undefined) {
    await prisma.sectorEvento.deleteMany({ where: { eventoId: id } });
  }

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
      ...(data.modo           !== undefined && { modo: data.modo as any }),   // ← agregado
      ...(data.permitirMultiplesAsientos !== undefined && { permitirMultiplesAsientos: data.permitirMultiplesAsientos }),
      ...(data.limiteAsientosPorUsuario  !== undefined && { limiteAsientosPorUsuario: data.limiteAsientosPorUsuario }),
      ...(data.seatMapConfig  !== undefined && { seatMapConfig: data.seatMapConfig }),
      ...(data.sectores && {
        sectores: {
          create: data.sectores.map(s => ({
            nombre: s.nombre,
            precio: s.precio,
            total: s.total,
            disponible: s.disponible ?? s.total
          }))
        }
      })
    },
    select: {
      id: true, titulo: true, descripcion: true, fecha: true,
      hora: true, ubicacion: true, direccion: true, imagenUrl: true,
      capacidad: true, precio: true, categoria: true, subcategoria: true,
      organizer: true, doorsOpen: true, estado: true, activo: true,
      seatMapConfig: true, modo: true, updatedAt: true,   // ← agregado
      sectores: {
        select: { id: true, nombre: true, precio: true, disponible: true, total: true }
      }
    }
  });

  if (data.seatMapConfig) {
    const config = data.seatMapConfig as any;
    const rows: any[] = config.rows || [];

    console.log('🔧 updateEvento - seatMapConfig recibido:', { rows: rows.length, sectors: config.sectors?.length, specialSeats: config.specialSeats?.length });

    if (rows.length > 0) {
      await prisma.asiento.deleteMany({ where: { eventoId: id } });
      console.log(`🗑️ Asientos eliminados del evento ${id}`);

      const sectoresBD = await prisma.sectorEvento.findMany({
        where: { eventoId: id },
        select: { id: true, nombre: true, precio: true }
      });

      const sectorPrecioMap = new Map<string, number>();
      for (const configSector of config.sectors || []) {
        const sectorBD = sectoresBD.find(
          s => s.nombre.trim().toLowerCase() === configSector.name.trim().toLowerCase()
        );
        if (sectorBD) {
          sectorPrecioMap.set(configSector.id, sectorBD.precio);
        } else {
          console.warn(`⚠️  Sector "${configSector.name}" no encontrado en BD, usando precio del evento`);
        }
      }

      const asientosACrear: Array<{
        fila:     string;
        numero:   number;
        precio:   number;
        estado:   'DISPONIBLE' | 'RESERVANDO' | 'VENDIDO' | 'BLOQUEADO';
        eventoId: string;
      }> = [];

      const sortedRows = [...rows].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

      for (const row of sortedRows) {
        const totalSeats: number = typeof row.seats === 'number' ? row.seats : 0;
        const sectorPrecioFila = sectorPrecioMap.get(row.sectorId);

        for (let i = 0; i < totalSeats; i++) {
          const specialSeat = config.specialSeats?.find(
            (s: any) => s.rowId === row.id && s.seatIndex === i
          );

          let estado: 'DISPONIBLE' | 'RESERVANDO' | 'VENDIDO' | 'BLOQUEADO' = 'DISPONIBLE';
          if (specialSeat?.status === 'sold')          estado = 'VENDIDO';
          else if (specialSeat?.status === 'reserved') estado = 'RESERVANDO';
          else if (specialSeat?.status === 'blocked')  estado = 'BLOQUEADO';

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
        console.log('═════════════════════════════════');
        console.log('📋 ASIENTOS A CREAR PARA EVENTO (UPDATE):', id);
        console.log('📋 Total de asientos a crear:', asientosACrear.length);
        console.log('═══════════════════════════════════');

        const resultado = await prisma.asiento.createMany({
          data: asientosACrear,
          skipDuplicates: true
        });
        console.log(`✅ ${resultado.count} asientos creados para el evento ${id}`);
      } else {
        console.warn(`⚠️  seatMapConfig recibido pero no se generaron asientos.`);
      }
    } else {
      console.warn('⚠️ No hay filas en seatMapConfig');
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
