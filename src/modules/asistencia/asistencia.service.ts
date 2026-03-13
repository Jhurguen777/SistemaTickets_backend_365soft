import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();

interface VerificarQRInput {
  qrCode: string;
  latitud: number | null;
  longitud: number | null;
  adminId: string;
}

interface MarcarAsistenciaManualInput {
  compraId: string;
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
          datosAsistente: true, // Incluir datos del asistente
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

      // 4. Actualizar datos del asistente
      if (compra.datosAsistente) {
        await (tx.datosAsistentes as any).update({
          where: { compraId: compra.id },
          data: {
            asistenciaRegistrada: true,
            fechaAsistencia: new Date(),
          },
        });
      }

      return {
        asistenciaId: asistencia.id,
        usuario:      compra.usuario,
        evento:       compra.evento,
        asiento:      compra.asiento,
        ingresoEn:    asistencia.ingresoEn,
        asistente: compra.datosAsistente, // Incluir datos del asistente
      };
    });
  }

  // Marca asistencia manualmente por ID de compra
  async marcarAsistenciaManual(input: MarcarAsistenciaManualInput) {
    const { compraId, adminId } = input;

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar la compra
      const compra = await tx.compra.findFirst({
        where: { id: compraId },
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          asiento: { select: { id: true, fila: true, numero: true } },
          evento:  { select: { id: true, titulo: true } },
          datosAsistente: true,
        },
      });

      if (!compra) {
        throw new Error("Compra no encontrada");
      }

      if (compra.estadoPago !== "PAGADO") {
        throw new Error("Compra no está pagada");
      }

      // Verificar si ya hay asistencia registrada
      if (compra.qrCodeUsado) {
        throw new Error("La asistencia ya fue registrada");
      }

      // 2. Marcar el QR como usado
      await tx.compra.update({
        where: { id: compraId },
        data: { qrCodeUsado: true },
      });

      // 3. Crear registro de asistencia
      const asistencia = await tx.asistencia.create({
        data: {
          compraId: compraId,
          usuarioId: compra.usuarioId,
          validadoPor: adminId,
        },
      });

      // 4. Actualizar datos del asistente
      if (compra.datosAsistente) {
        await (tx.datosAsistentes as any).update({
          where: { compraId: compraId },
          data: {
            asistenciaRegistrada: true,
            fechaAsistencia: new Date(),
          },
        });
      }

      return {
        asistenciaId: asistencia.id,
        usuario:      compra.usuario,
        evento:       compra.evento,
        asiento:      compra.asiento,
        ingresoEn:    asistencia.ingresoEn,
        asistente: compra.datosAsistente,
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
        datosAsistente: true,
        evento: { select: { modo: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return compras.map((c) => {
      // Priorizar DatosAsistentes (nueva tabla), luego campos directos de Compra, luego cuenta usuario
      const da = c.datosAsistente
      const nombreCompleto = da
        ? `${da.nombre} ${da.apellido}`.trim()
        : [c.nombreAsistente, c.apellidoAsistente].filter(Boolean).join(" ").trim()
      const esGeneral = (c as any).evento?.modo === "CANTIDAD"
      return {
        id:                  c.id,
        nombre:              nombreCompleto || c.usuario.nombre,
        email:               da?.email || c.emailAsistente || c.usuario.email,
        ci:                  da?.documento || c.documentoAsistente || c.usuario.ci || "",
        agencia:             da?.oficina || c.oficina || c.usuario.agencia || "N/A",
        asiento:             c.asiento ? `${c.asiento.fila}${c.asiento.numero}` : null,
        numeroBoleto:        esGeneral ? (c as any).numeroBoleto ?? null : null,
        esGeneral,
        asistencia:          c.asistencia ? "ASISTIO" : "PENDIENTE",
        horaCheckIn:         c.asistencia?.ingresoEn ?? null,
        qrCode:              c.qrCode,
        asistenteRegistrada: da?.asistenciaRegistrada || false,
        fechaAsistencia:     da?.fechaAsistencia || null,
      }
    });
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