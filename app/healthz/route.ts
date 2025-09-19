import { NextResponse } from 'next/server';
import postgres from 'postgres';

export async function GET() {
  try {
    const url =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL;

    if (!url) {
      return NextResponse.json(
        { ok: false, reason: 'DB URL missing' },
        { status: 500 },
      );
    }

    const sql = postgres(url, { ssl: 'require' });
    const [{ now }] = await sql`SELECT NOW() as now`;
    const ext =
      await sql`SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'`;

    return NextResponse.json({
      ok: true,
      now,
      uuid_ossp_installed: ext.length > 0,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
