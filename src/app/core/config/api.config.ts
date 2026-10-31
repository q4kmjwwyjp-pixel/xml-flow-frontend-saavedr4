/**
 * URL base de la API de NestJS:
 * - En desarrollo local (localhost / 127.0.0.1): apunta a http://localhost:3000
 * - En la nube (Vercel): apunta automáticamente a tu propio Backend en Render
 *   (100% independiente del repositorio original).
 */
export const PROD_API_URL = 'https://xml-flow-backend-saavedr4.onrender.com';

export const API_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : PROD_API_URL;
