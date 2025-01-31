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