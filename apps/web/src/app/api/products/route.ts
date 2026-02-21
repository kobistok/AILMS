import { NextResponse } from 'next/server';
import { getDb, products as productsTable, documents as documentsTable } from '@ailms/db';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDb();

    const rows = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        description: productsTable.description,
        createdAt: productsTable.createdAt,
        createdBy: productsTable.createdBy,
        docCount: sql<number>`count(${documentsTable.id})::int`,
      })
      .from(productsTable)
      .leftJoin(documentsTable, eq(documentsTable.productId, productsTable.id))
      .groupBy(productsTable.id)
      .orderBy(productsTable.createdAt);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('[Products API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
