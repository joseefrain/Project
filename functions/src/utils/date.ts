import { DateTime } from "luxon";
import { format } from "path";

export function getDateInManaguaTimezone(): Date {
  const hoy = new Date();

  const formatter = new Intl.DateTimeFormat('es-NI', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Descomponer la fecha formateada en partes
  const parts = formatter.formatToParts(hoy);

  // Extraer los valores necesarios
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const second = parts.find((p) => p.type === 'second')?.value;

  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error('Error al procesar la fecha en el timezone especificado.');
  }

  // Crear un string ISO compatible
  const fechaISO = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  // Convertir el string a un objeto Date
  return new Date(fechaISO);
}

export const formaterInManageTimezone = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('es-NI', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Descomponer la fecha formateada en partes
  const parts = formatter.formatToParts(date);

  // Extraer los valores necesarios
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const second = parts.find((p) => p.type === 'second')?.value;

  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error('Error al procesar la fecha en el timezone especificado.');
  }

  // Crear un string ISO compatible
  const fechaISO = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  // Convertir el string a un objeto Date
  return new Date(fechaISO);
}

export function isValidDateWithFormat(
  dateString: string,
  format: string = "yyyy-MM-dd"
): DateTime | null {
  // Parsea con el formato especificado y modo estricto
  const date = DateTime.fromFormat(dateString, format);
  return date.isValid ? date : null
}

export const useTodayDateRange = () => {
  const starDateJs = getDateInManaguaTimezone();
  const endDateJS = getDateInManaguaTimezone();
  let startDateISO = new Date(starDateJs.setHours(-6, 0, 0, 0)).toISOString()

  let endDateISO = new Date(endDateJS.setHours(17, 59, 59, 59)).toISOString()

  return [startDateISO, endDateISO]
};

export const useSetDateRange = (startDate: Date, endDate: Date) => {
  let startDateISO = new Date(startDate.setHours(-6, 0, 0, 0)).toISOString()
  let endDateISO = new Date(endDate.setHours(17, 59, 59, 999)).toISOString()

  return [startDateISO, endDateISO]
};

export const parseDate = (dateStr: string, format: string): DateTime => {
  const date = DateTime.fromFormat(dateStr, format);
  if (!date.isValid) throw new Error(`Fecha inválida: ${dateStr}`);
  return date;
};

export const formaterToISO = (date: Date) => {
  return new Date(DateTime.fromJSDate(date).toISO()!)
}