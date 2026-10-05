import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'eventos', pathMatch: 'full' },
  {
    path: 'eventos',
    loadComponent: () => import('./pages/eventos/eventos-page').then(m => m.EventosPage)
  },
  {
    path: 'eventos/:id/horario',
    loadComponent: () => import('./pages/horario/horario-page').then(m => m.HorarioPage)
  },
  {
    path: 'personas',
    loadComponent: () => import('./pages/personas/personas-page').then(m => m.PersonasPage)
  },
  { path: '**', redirectTo: 'eventos' }
];
