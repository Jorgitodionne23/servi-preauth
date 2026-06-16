export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'America/Mexico_City';

if (!process.env.TZ) {
  process.env.TZ = APP_TIME_ZONE;
}
