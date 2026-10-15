export const SESSION_SECONDS = 15 * 60;
export const SESSION_COOKIE = 'nutritech_session';

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error(
      'Configura JWT_SECRET con al menos 32 bytes en el entorno.',
    );
  }
  return secret;
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  };
}
