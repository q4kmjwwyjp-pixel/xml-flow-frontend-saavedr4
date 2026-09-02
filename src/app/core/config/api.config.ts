/**
 * URL base de la API de NestJS. En desarrollo corre en localhost:3000 (ver
 * src/main.ts del backend — CORS sólo está habilitado para
 * http://localhost:4200, así que corre `ng serve` en el puerto default).
 *
 * TODO: mover esto a environment.ts / environment.prod.ts cuando el
 * backend se despliegue a un servidor real, para no tener la URL de
 * producción hardcodeada aquí.
 */
export const API_URL = 'http://localhost:3000';
