import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();

interface VerificarQRInput {
  qrCode: string;
  latitud: number | null;
  longitud: number | null;
  adminId: string;
}

export class AsistenciaService {
  // Verifica la validez del QR y registra la asistencia en una transacción atómica
  async verificarYRegistrar(input: VerificarQRInput) {
    const { qrCode, latitud, longitud, adminId } = input;

    const ubicacionGPS =
      latitud !== null && longitud !== null ? `${latitud},${longitud}` : null;

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar la compra directamente por qrCode (formato QR-XXX-timestamp)
      const compra = await tx.compra.findFirst({
        where: { qrCode },
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          asiento: { select: { id: true, fila: true, numero: true } },
          evento:  { select: { id: true, titulo: true } },
        },
      });

      if (!compra) {
        throw new Error("QR no encontrado");
      }

      if (compra.estadoPago !== "PAGADO") {
        throw new Error("Compra no está pagada");
      }

      if (compra.qrCodeUsado) {
        throw new Error("QR ya fue utilizado");
      }

      // 2. Marcar el QR como usado
      await tx.compra.update({
        where: { id: compra.id },
        data: { qrCodeUsado: true },
      });

      // 3. Crear registro de asistencia
      const asistencia = await tx.asistencia.create({
        data: {
          compraId:    compra.id,
          usuarioId:   compra.usuarioId,
          ubicacionGPS,
          validadoPor: adminId,
        },
      });

      return {
        asistenciaId: asistencia.id,
        usuario:      compra.usuario,
        evento:       compra.evento,
        asiento:      compra.asiento,
        ingresoEn:    asistencia.ingresoEn,
      };
    });
  }

  // Retorna todos los compradores de un evento con su estado de asistencia
  async listarPorEvento(eventoId: string) {
    const compras = await prisma.compra.findMany({
      where: { eventoId, estadoPago: "PAGADO" },
      include: {
        usuario: { select: { nombre: true, email: true, ci: true, agencia: true } },
        asiento: { select: { fila: true, numero: true } },
        asistencia: { select: { id: true, ingresoEn: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return compras.map((c) => ({
      id:          c.id,
      nombre:      c.usuario.nombre,
      email:       c.usuario.email,
      ci:          c.usuario.ci ?? "",
      agencia:     c.usuario.agencia,
      asiento:     c.asiento
        ? `${c.asiento.fila}${c.asiento.numero}`
        : "N/A",
      asistencia:  c.asistencia ? "ASISTIO" : "PENDIENTE",
      horaCheckIn: c.asistencia?.ingresoEn ?? null,
      qrCode:      c.qrCode,
    }));
  }

  // Estadísticas de asistencia para un evento
  async obtenerEstadisticas(eventoId: string) {
    const [totalVendidos, totalAsistentes, evento] = await Promise.all([
      prisma.compra.count({
        where: { eventoId, estadoPago: "PAGADO" },
      }),
      prisma.asistencia.count({
        where: { compra: { eventoId } },
      }),
      prisma.evento.findUnique({
        where: { id: eventoId },
        select: { titulo: true, capacidad: true },
      }),
    ]);

    const tasaAsistencia =
      totalVendidos > 0
        ? Math.round((totalAsistentes / totalVendidos) * 100)
        : 0;

    return {
      evento:          evento?.titulo ?? "Desconocido",
      capacidadTotal:  evento?.capacidad ?? 0,
      ticketsVendidos: totalVendidos,
      asistentes:      totalAsistentes,
      ausentes:        totalVendidos - totalAsistentes,
      tasaAsistencia:  `${tasaAsistencia}%`,
    };
  }

  // Genera un archivo Excel con la lista completa de asistentes
  async generarExcel(eventoId: string): Promise<Buffer> {
    const asistentes = await this.listarPorEvento(eventoId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Asistentes");

    sheet.columns = [
      { header: "Nombre",           key: "nombre",      width: 30 },
      { header: "Email",            key: "email",       width: 35 },
      { header: "CI",               key: "ci",          width: 15 },
      { header: "Asiento",          key: "asiento",     width: 15 },
      { header: "Estado",           key: "asistencia",  width: 15 },
      { header: "Fecha de Ingreso", key: "horaCheckIn", width: 25 },
    ];

    sheet.getRow(1).eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2E75B6" },
      };
    });

    asistentes.forEach((a) => {
      sheet.addRow({
        nombre:      a.nombre,
        email:       a.email,
        ci:          a.ci || "-",
        asiento:     a.asiento,
        asistencia:  a.asistencia,
        horaCheckIn: a.horaCheckIn
          ? new Date(a.horaCheckIn).toLocaleString("es-AR")
          : "-",
      });
    });

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
}