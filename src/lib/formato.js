/* ============================================================
   Bitácora de Viaje · lib/formato.js
   Formato de fechas, cifras y magnitudes en español.
   ============================================================ */

const LOCALE = "es-ES";

const fmtFecha = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const fmtFechaCorta = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const fmtMes = new Intl.DateTimeFormat(LOCALE, { month: "short" });

const fmtNumero = new Intl.NumberFormat(LOCALE);

const fmtNumero1 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Convierte "YYYY-MM-DD" (o ISO) en Date sin desfase de zona horaria. */
export function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const texto = String(valor);
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (soloFecha) {
    return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]));
  }
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha larga: "12 de marzo de 2025" */
export function fecha(valor) {
  const d = aFecha(valor);
  return d ? fmtFecha.format(d) : "—";
}

/** Fecha corta: "12 mar 2025" */
export function fechaCorta(valor) {
  const d = aFecha(valor);
  return d ? fmtFechaCorta.format(d) : "—";
}

/** "12 mar" */
export function fechaMes(valor) {
  const d = aFecha(valor);
  if (!d) return "—";
  return fmtMes.format(d).replace(".", "");
}

/** Rango de fechas de viaje. */
export function rangoFechas(inicio, fin) {
  const dInicio = aFecha(inicio);
  const dFin = aFecha(fin);
  if (!dInicio && !dFin) return "Sin fechas";
  if (dInicio && !dFin) return `Desde el ${fechaCorta(dInicio)}`;
  if (!dInicio && dFin) return `Hasta el ${fechaCorta(dFin)}`;
  if (dInicio.getFullYear() === dFin.getFullYear()) {
    const mes = new Intl.DateTimeFormat(LOCALE, { month: "long" });
    const m1 = mes.format(dInicio);
    const m2 = mes.format(dFin);
    if (m1 === m2) {
      return `${dInicio.getDate()}–${dFin.getDate()} de ${m1} ${dFin.getFullYear()}`;
    }
    return `${dInicio.getDate()} ${m1} – ${dFin.getDate()} ${m2} ${dFin.getFullYear()}`;
  }
  return `${fechaCorta(dInicio)} – ${fechaCorta(dFin)}`;
}

/** Número con separador de miles. */
export function numero(valor, decimales = false) {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n)) return "0";
  return decimales ? fmtNumero1.format(n) : fmtNumero.format(Math.round(n));
}

/** Distancia legible: "842 m" o "12,4 km". */
export function distancia(metros) {
  const m = Number(metros ?? 0);
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m < 1000) return `${numero(m)} m`;
  return `${numero(m / 1000, true)} km`;
}

/** Ascenso: "+1.240 m" */
export function ascension(metros) {
  const m = Math.round(Number(metros ?? 0));
  if (!Number.isFinite(m) || m === 0) return "—";
  return `${m > 0 ? "+" : "−"}${numero(Math.abs(m))} m`;
}

/** Duración: "3 h 25 min" o "45 min". */
export function duracion(segundos) {
  const s = Math.round(Number(segundos ?? 0));
  if (!Number.isFinite(s) || s <= 0) return "—";
  const horas = Math.floor(s / 3600);
  const minutos = Math.round((s % 3600) / 60);
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;
  return `${horas} h ${minutos} min`;
}

/** Tamaño de archivo: "3,4 MB". */
export function bytes(valor) {
  const b = Number(valor ?? 0);
  if (!Number.isFinite(b) || b <= 0) return "0 KB";
  const unidades = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < unidades.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${numero(n, i > 1)} ${unidades[i]}`;
}

/** Fecha relativa corta: "hace 3 días". */
export function haceCuanto(fechaISO) {
  const d = aFecha(fechaISO);
  if (!d) return "";
  const segundos = Math.floor((Date.now() - d.getTime()) / 1000);
  if (segundos < 60) return "hace un momento";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  return `hace ${anios} ${anios === 1 ? "año" : "años"}`;
}

/** Valida un correo electrónico. */
export function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor ?? "").trim());
}

/** Iniciales para el avatar. */
export function iniciales(nombre) {
  const partes = String(nombre ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
