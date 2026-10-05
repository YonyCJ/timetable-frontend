export const environment = {
  production: false,
  apiUrl: 'http://localhost:8086',
  // Mientras no exista autenticación/multi-tenant, se usa un companyId fijo para todo el sistema.
  companyId: '4D2F2300-8CB6-443B-BB8B-AD6AEEEBF975',
  // Zona horaria IANA usada por toda la app para "hoy" y para formatear/parsear fechas
  // (ver DateService). Cambiar solo este valor para que todo el frontend apunte a otra zona
  // (ej. la del navegador) sin tocar cada pantalla por separado.
  timeZone: 'America/Lima'
};
