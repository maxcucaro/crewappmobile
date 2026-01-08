/**
 * Utility per gestire date in orario locale italiano
 * Evita problemi con UTC/timezone quando si confrontano date
 */

/**
 * Converte una Date in stringa formato YYYY-MM-DD usando l'orario locale
 * @param date - La data da convertire (default: ora corrente)
 * @returns Stringa nel formato "YYYY-MM-DD"
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Ottiene la data di oggi in formato YYYY-MM-DD (orario locale)
 * @returns Stringa nel formato "YYYY-MM-DD"
 */
export function getTodayString(): string {
  return toLocalDateString(new Date());
}

/**
 * Ottiene la data di domani in formato YYYY-MM-DD (orario locale)
 * @returns Stringa nel formato "YYYY-MM-DD"
 */
export function getTomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toLocalDateString(tomorrow);
}

/**
 * Ottiene la data di ieri in formato YYYY-MM-DD (orario locale)
 * @returns Stringa nel formato "YYYY-MM-DD"
 */
export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return toLocalDateString(yesterday);
}

/**
 * Aggiunge giorni a una data
 * @param date - La data di partenza
 * @param days - Numero di giorni da aggiungere (può essere negativo)
 * @returns Nuova data
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Ottiene il primo giorno del mese in formato YYYY-MM-DD (orario locale)
 * @param year - Anno
 * @param month - Mese (0-11)
 * @returns Stringa nel formato "YYYY-MM-DD"
 */
export function getFirstDayOfMonth(year: number, month: number): string {
  return toLocalDateString(new Date(year, month, 1));
}

/**
 * Ottiene l'ultimo giorno del mese in formato YYYY-MM-DD (orario locale)
 * @param year - Anno
 * @param month - Mese (0-11)
 * @returns Stringa nel formato "YYYY-MM-DD"
 */
export function getLastDayOfMonth(year: number, month: number): string {
  return toLocalDateString(new Date(year, month + 1, 0));
}

/**
 * Calcola differenza in giorni tra due date
 * @param date1 - Prima data (stringa YYYY-MM-DD)
 * @param date2 - Seconda data (stringa YYYY-MM-DD)
 * @returns Numero di giorni di differenza
 */
export function daysDifference(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00');
  const d2 = new Date(date2 + 'T00:00:00');
  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se una data è oggi
 * @param dateStr - Data in formato YYYY-MM-DD
 * @returns true se la data è oggi
 */
export function isToday(dateStr: string): boolean {
  return dateStr === getTodayString();
}

/**
 * Verifica se una data è domani
 * @param dateStr - Data in formato YYYY-MM-DD
 * @returns true se la data è domani
 */
export function isTomorrow(dateStr: string): boolean {
  return dateStr === getTomorrowString();
}

/**
 * Verifica se una data è ieri
 * @param dateStr - Data in formato YYYY-MM-DD
 * @returns true se la data è ieri
 */
export function isYesterday(dateStr: string): boolean {
  return dateStr === getYesterdayString();
}

/**
 * Converte un timestamp UTC in ora italiana (Europe/Rome) formato HH:MM
 * @param timestamp - Timestamp UTC (ISO string o time string)
 * @returns Ora in formato HH:MM nel timezone italiano
 */
export function toItalianTime(timestamp: string | null): string {
  if (!timestamp) return '';

  // Se è già in formato HH:MM
  if (/^\d{2}:\d{2}$/.test(timestamp)) {
    return timestamp;
  }

  // Se è in formato HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(timestamp)) {
    return timestamp.substring(0, 5);
  }

  // Se è un timestamp ISO
  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('it-IT', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/Rome'
      });
    }
  } catch (e) {
    console.error('Errore parsing timestamp:', e);
  }

  return '';
}

/**
 * Converte un timestamp UTC in data e ora italiana completa
 * @param timestamp - Timestamp UTC (ISO string)
 * @returns Data e ora formattata in italiano
 */
export function toItalianDateTime(timestamp: string | null): string {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (e) {
    console.error('Errore parsing timestamp:', e);
  }

  return '';
}
