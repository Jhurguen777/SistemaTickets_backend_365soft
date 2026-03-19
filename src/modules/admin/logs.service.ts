import prisma from '../../shared/config/database';

export const logActividad = async (data: {
  adminId: string;
  adminNombre: string;
  accion: string;
  detalles: string;
  ip?: string;
}) => {
  try {
    await prisma.logActividad.create({ data });
  } catch (e) {
    // No interrumpir el flujo principal si el log falla
    console.error('Error al guardar log:', e);
  }
};

export const getActividades = async () => {
  return prisma.logActividad.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      adminId: true,
      adminNombre: true,
      accion: true,
      detalles: true,
      ip: true,
      createdAt: true,
    }
  });
};

export const getSesionesActivas = async () => {
  return prisma.adminRol.findMany({
    where: { estado: 'ACTIVO' },
    select: {
      id: true,
      nombre: true,
      email: true,
      tipoRol: true,
      ultimoAcceso: true,
    },
    orderBy: { ultimoAcceso: 'desc' }
  });
};
