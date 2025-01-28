import { DateTime } from 'luxon';

export function getDateInManaguaTimezone(): Date {
  const managuaTime = DateTime.now().setZone('America/Managua');
  return new Date(managuaTime.toISO() || '');
}
