import { NextRequest, NextResponse } from 'next/server';
import { signJWT } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();
    
    if (role !== 'ayah' && role !== 'bunda') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const userId = role === 'ayah' ? 'user-ayah-id-static-2026' : 'user-bunda-id-static-2026';
    
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not seeded' }, { status: 404 });
    }

    // Sign session token
    const token = await signJWT({ userId: user.id, name: user.name });

    const response = NextResponse.json({ success: true, user });
    
    // Set cookie
    response.cookies.set('wnab_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
