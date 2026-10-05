import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

// Centraliza toda conversión de fecha/hora del frontend contra UNA sola zona horaria
// configurable (environment.timeZone). Si más adelante se quiere usar la zona del navegador
// o la de otro país, se cambia solo ahí — nada en las páginas debe tocarse.
@Injectable({ providedIn: 'root' })
export class DateService {
  private readonly timeZone = environment.timeZone;

  // "Hoy" según la zona horaria configurada, no la del dispositivo/navegador que abre la app.
  today(): Date {
    return this.parseIsoDate(this.toIsoDate(new Date()));
  }

  // Date -> "YYYY-MM-DD" en la zona horaria configurada. Usa Intl.DateTimeFormat en vez de
  // los getters locales del Date para no depender de la zona horaria del sistema operativo.
  toIsoDate(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  // "YYYY-MM-DD" -> Date. Arma el Date a partir de los componentes tal cual, sin pasar por
  // UTC — "new Date('YYYY-MM-DD')" se interpreta como medianoche UTC y por eso mostraba un
  // día antes en Perú (UTC-5). Un valor de solo fecha no tiene huso horario propio, así que
  // esto ya representa el mismo día sin importar dónde esté el navegador que lo abre.
  parseIsoDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  // "HH:mm:ss" -> Date (solo se usa la hora/minuto, la parte de fecha es irrelevante).
  parseIsoTime(time: string): Date {
    const [h, m, s] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, s || 0, 0);
    return d;
  }

  toIsoTime(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}:00`;
  }

  addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  }
}
