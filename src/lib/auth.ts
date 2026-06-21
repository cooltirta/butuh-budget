import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'supersecretwNAB_key_for_ayah_dan_bunda_2026'
);

export async function signJWT(payload: { userId: string; name: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: string; name: string };
  } catch (err) {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('wnab_session')?.value;
  if (!token) return null;
  return await verifyJWT(token);
}
