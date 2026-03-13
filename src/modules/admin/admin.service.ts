// src/modules/admin/admin.service.ts
import prisma from '../../shared/config/database';

// ── INTERFACES ────────────────────────────────────────────────────
export interface SalesReportFilters {
  startDate?: Date;
  endDate?: Date;
  eventoId?: string;
}

export interface AgenciesRankingFilters {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ExportFilters {
  type: 'ventas' | 'asistencia' | 'agencias';
  startDate?: Date;
  endDate?: Date;
  eventoId?: string;
}

// ── DASHBOARD KPIs ────────────────────────────────────────────────
export const getDashboardKPIs = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

  // Total de eventos
  const totalEventos = await prisma.evento.count();

  // Eventos activos
  const eventosActivos = await prisma.evento.count({
    where: { estado: 'ACTIVO' }
  });

  // Total de ventas (mes actual)
  const ventasMes = await prisma.compra.aggregate({
    where: {
      estadoPago: 'PAGADO',
      createdAt: { gte: startOfMonth }
    },
    _sum: { monto: true },
    _count: true
  });

  // Total de ventas (semana actual)
  const ventasSemana = await prisma.compra.aggregate({
    where: {
      estadoPago: 'PAGADO',
      createdAt: { gte: startOfWeek }
    },
    _sum: { monto: true },
    _count: true
  });

  // Total de usuarios
  const totalUsuarios = await prisma.usuario.count();

  // Usuarios nuevos (mes actual)
  const usuariosMes = await prisma.usuario.count({
    where: { createdAt: { gte: startOfMonth } }
  });

  // Porcentaje de asistencia
  const totalAsientos = await prisma.asiento.count();
  const asientosVendidos = await prisma.asiento.count({
    where: { estado: 'VENDIDO' }
  });
  const asientosConAsistencia = await prisma.asistencia.count();
  const porcentajeAsistencia = totalAsientos > 0
    ? (asientosConAsistencia / totalAsientos) * 100
    : 0;

  // Eventos próximos (próximos 30 días)
  const proximosEventos = await prisma.evento.count({
    where: {
      estado: 'ACTIVO',
      fecha: {
        gte: now,
        lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      }
    }
  });

  return {
    eventos: {
      total: totalEventos,
      activos: eventosActivos,
      proximos: proximosEventos
    },
    ventas: {
      mes: {
        monto: ventasMes._sum.monto || 0,
        cantidad: ventasMes._count
      },
      semana: {
        monto: ventasSemana._sum.monto || 0,
        cantidad: ventasSemana._count
      }
    },
    usuarios: {
      total: totalUsuarios,
      nuevosMes: usuariosMes
    },
    asistencia: {
      porcentaje: Math.round(porcentajeAsistencia * 100) / 100,
      totalAsientos,
      asientosVendidos,
      asientosConAsistencia
    }
  };
};

// ── REPORTES DE VENTAS ────────────────────────────────────────────
export const getSalesReport = async (filters: SalesReportFilters) => {
  const where: any = {
    estadoPago: 'PAGADO'
  };

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  if (filters.eventoId) {
    where.eventoId = filters.eventoId;
  }

  // Ventas totales
  const ventas = await prisma.compra.findMany({
    where,
    include: {
      evento: {
        select: { titulo: true, fecha: true }
      },
      usuario: {
        select: { nombre: true, email: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Resumen por evento
  const ventasPorEvento = await prisma.compra.groupBy({
    by: ['eventoId'],
    where,
    _sum: { monto: true },
    _count: true,
  });

  const eventosDetalles = await prisma.evento.findMany({
    where: {
      id: { in: ventasPorEvento.map(v => v.eventoId) }
    },
    select: { id: true, titulo: true }
  });

  const resumenEventos = ventasPorEvento.map(venta => ({
    evento: eventosDetalles.find(e => e.id === venta.eventoId)?.titulo || 'Desconocido',
    monto: venta._sum.monto || 0,
    cantidad: venta._count
  }));

  // Monto total
  const montoTotal = ventas.reduce((sum, v) => sum + v.monto, 0);

  return {
    total: {
      monto: montoTotal,
      cantidad: ventas.length
    },
    porEvento: resumenEventos,
    detalle: ventas
  };
};

// ── REPORTES DE ASISTENCIA ───────────────────────────────────────────
export const getAttendanceReport = async (eventoId?: string) => {
  const whereEvento = eventoId ? { id: eventoId } : {};

  // Obtener todos los eventos
  const eventos = await prisma.evento.findMany({
    where: whereEvento,
    select: {
      id: true,
      titulo: true,
      fecha: true,
      ubicacion: true,
      capacidad: true
    }
  });

  // Para cada evento, calcular asistencia
  const reporte = await Promise.all(
    eventos.map(async (evento) => {
      const totalAsientos = await prisma.asiento.count({
        where: { eventoId: evento.id }
      });

      const asientosVendidos = await prisma.asiento.count({
        where: {
          eventoId: evento.id,
          estado: 'VENDIDO'
        }
      });

      const asientosConAsistencia = await prisma.asistencia.count({
        where: {
          compra: {
            eventoId: evento.id
          }
        }
      });

      const porcentajeAsistencia = asientosVendidos > 0
        ? (asientosConAsistencia / asientosVendidos) * 100
        : 0;

      const porcentajeOcupacion = totalAsientos > 0
        ? (asientosVendidos / totalAsientos) * 100
        : 0;

      return {
        evento: evento.titulo,
        fecha: evento.fecha,
        ubicacion: evento.ubicacion,
        capacidad: evento.capacidad,
        asientos: {
          total: totalAsientos,
          vendidos: asientosVendidos,
          conAsistencia: asientosConAsistencia
        },
        porcentajes: {
          asistencia: Math.round(porcentajeAsistencia * 100) / 100,
          ocupacion: Math.round(porcentajeOcupacion * 100) / 100
        }
      };
    })
  );

  return reporte;
};

// ── REPORTES POR AGENCIAS (RANKING) ───────────────────────────────
export const getAgenciesRanking = async (filters: AgenciesRankingFilters) => {
  const where: any = {
    estadoPago: 'PAGADO'
  };

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  // Obtener compras con agencia
  const compras = await prisma.compra.findMany({
    where,
    include: {
      usuario: {
        select: { agencia: true }
      }
    }
  });

  // Agrupar por agencia
  const ventasPorAgencia = new Map<string, { monto: number; cantidad: number }>();

  compras.forEach(compra => {
    const agencia = compra.usuario.agencia || 'Sin agencia';
    const current = ventasPorAgencia.get(agencia) || { monto: 0, cantidad: 0 };
    current.monto += compra.monto;
    current.cantidad += 1;
    ventasPorAgencia.set(agencia, current);
  });

  // Convertir a array y ordenar
  const ranking = Array.from(ventasPorAgencia.entries())
    .map(([agencia, data]) => ({
      agencia,
      monto: data.monto,
      cantidad: data.cantidad
    }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, filters.limit || 10);

  return ranking;
};

// ── EXPORTAR A CSV ──────────────────────────────────────────────────
export const exportToCSV = async (filters: ExportFilters): Promise<string> => {
  let csv = '';

  switch (filters.type) {
    case 'ventas':
      const ventas = await getSalesReport(filters);
      csv = 'Evento,Fecha,Monto,Usuario,Email\n';
      ventas.detalle.forEach((venta: any) => {
        csv += `"${venta.evento.titulo}",${new Date(venta.createdAt).toISOString()},${venta.monto},"${venta.usuario?.nombre || 'N/A'}","${venta.usuario?.email || 'N/A'}"\n`;
      });
      break;

    case 'asistencia':
      const asistencia = await getAttendanceReport(filters.eventoId);
      csv = 'Evento,Fecha,Capacidad,Vendidos,Con Asistencia,% Asistencia,% Ocupación\n';
      asistencia.forEach((a: any) => {
        csv += `"${a.evento}",${new Date(a.fecha).toISOString()},${a.capacidad},${a.asientos.vendidos},${a.asientos.conAsistencia},${a.porcentajes.asistencia},${a.porcentajes.ocupacion}\n`;
      });
      break;

    case 'agencias':
      const agencias = await getAgenciesRanking({
        startDate: filters.startDate,
        endDate: filters.endDate
      });
      csv = 'Agencia,Monto Total,Cantidad Ventas\n';
      agencias.forEach(a => {
        csv += `"${a.agencia}",${a.monto},${a.cantidad}\n`;
      });
      break;
  }

  return csv;
};

// ── OBTENER USUARIOS ──────────────────────────────────────────────────
export const getUsersList = async () => {
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      ci: true,
      telefono: true,
      agencia: true,
      createdAt: true,
      _count: {
        select: {
          compras: true,
          asistencias: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Transformar al formato que espera el frontend
  return usuarios.map(usuario => {
    // Calcular total gastado
    const totalGastado = usuario._count.compras > 0
      ? 0 // TODO: Calcular sum real de compras
      : 0;

    return {
      id: usuario.id,
      nombre: `${usuario.nombre}${usuario.apellido ? ' ' + usuario.apellido : ''}`,
      email: usuario.email,
      telefono: usuario.telefono || 'No registrado',
      ci: usuario.ci || 'No registrado',
      direccion: undefined,
      ciudad: usuario.agencia || undefined,
      estado: 'ACTIVO', // Todos los usuarios están activos por ahora
      totalCompras: usuario._count.compras,
      totalGastado,
      ultimoAcceso: undefined, // No trackeamos último acceso todavía
      createdAt: usuario.createdAt
    };
  });
};

// ── OBTENER COMPRAS DE USUARIO ────────────────────────────────────────
export const getUserPurchases = async (userId: string) => {
  const compras = await prisma.compra.findMany({
    where: { usuarioId: userId },
    include: {
      evento: {
        select: {
          id: true,
          titulo: true,
          fecha: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return compras.map(compra => ({
    id: compra.id,
    eventId: compra.evento.id,
    eventTitle: compra.evento.titulo,
    eventDate: new Date(compra.evento.fecha),
    cantidad: 1, // TODO: Calcular cantidad correcta
    totalPagado: compra.monto,
    estadoPago: compra.estadoPago,
    fechaCompra: compra.createdAt
  }));
};

// ── OBTENER USUARIOS POR EVENTO ────────────────────────────────────────
export const getEventUsers = async (eventId: string) => {
  // Obtener todas las compras PAGADAS para este evento con sus datos de asistentes
  const compras = await prisma.compra.findMany({
    where: {
      eventoId: eventId,
      estadoPago: 'PAGADO'
    },
    include: {
      usuario: {
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          ci: true,
          telefono: true,
          agencia: true,
          createdAt: true
        }
      },
      asiento: {
        select: {
          fila: true,
          numero: true
        }
      },
      evento: {
        select: {
          id: true,
          titulo: true
        }
      },
      datosAsistente: true // Incluir datos de asistentes individuales
    },
    orderBy: { createdAt: 'desc' }
  });

  // Crear un array con cada asistente individualmente
  const asistentes = compras.map(compra => {
    const datosAsistente = compra.datosAsistente;
    const asientoStr = compra.asiento
      ? `${compra.asiento.fila}${compra.asiento.numero}`
      : `#${compra.numeroBoleto ?? ''}`.trim();

    // Usar datos de DatosAsistentes si existen, sino usar los campos legacy
    const nombre = datosAsistente?.nombre || compra.nombreAsistente || compra.usuario.nombre;
    const apellido = datosAsistente?.apellido || compra.apellidoAsistente || compra.usuario.apellido || '';
    const email = datosAsistente?.email || compra.emailAsistente || compra.usuario.email;
    const telefono = datosAsistente?.telefono || compra.telefonoAsistente || compra.usuario.telefono || 'No registrado';
    const documento = datosAsistente?.documento || compra.documentoAsistente || compra.usuario.ci || 'No registrado';
    const oficina = datosAsistente?.oficina || compra.oficina || compra.usuario.agencia || 'General';
    const asistenciaRegistrada = datosAsistente?.asistenciaRegistrada || false;
    const fechaAsistencia = datosAsistente?.fechaAsistencia || null;

    return {
      id: compra.id, // ID de la compra como identificador del asistente
      eventId: compra.evento.id,
      eventTitle: compra.evento.titulo,
      nombre: `${nombre}${apellido ? ' ' + apellido : ''}`,
      nombreCompleto: nombre,
      apellido: apellido || '',
      email: email,
      telefono: telefono,
      documento: documento,
      sector: oficina,
      cantidad: 1, // Cada asistente representa 1 ticket
      totalPagado: compra.monto,
      estadoPago: compra.estadoPago,
      fechaCompra: compra.createdAt,
      asiento: asientoStr,
      asientos: [asientoStr],
      // Datos del comprador (para referencia)
      comprador: {
        id: compra.usuario.id,
        nombre: `${compra.usuario.nombre}${compra.usuario.apellido ? ' ' + compra.usuario.apellido : ''}`,
        email: compra.usuario.email
      },
      // Datos de asistencia
      asistenciaRegistrada,
      fechaAsistencia,
      qrCode: compra.qrCode
    };
  });

  return asistentes;
};
