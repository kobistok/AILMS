import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSupabase, products as productsTable, documents as documentsTable } from '@ailms/db';
import { createSupabaseServerClient } from '@/lib/supabase';
import { eq } from 'drizzle-orm';
import { ingestDocumentSync } from '@ailms/ai';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const db = getDb();
    const supabase = getSupabase();

    // Get authenticated user (middleware guarantees auth, but capture ID for product creation)
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();

    // Resolve or create product
    let productId: string;
    const existingProductId = formData.get('productId') as string | null;
    const productName = formData.get('productName') as string | null;
    const productDescription = formData.get('productDescription') as string | null;

    if (existingProductId) {
      productId = existingProductId;
    } else if (productName) {
      const [product] = await db
        .insert(productsTable)
        .values({ name: productName, description: productDescription ?? '', createdBy: user?.id ?? null })
        .onConflictDoNothing()
        .returning();

      if (!product) {
        const [existing] = await db.select().from(productsTable).where(eq(productsTable.name, productName));
        if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        productId = existing.id;
      } else {
        productId = product.id;
      }
    } else {
      return NextResponse.json({ error: 'Either productId or productName is required' }, { status: 400 });
    }

    const files = formData.getAll('files') as File[];
    if (files.length === 0) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

    const results: Array<{ filename: string; documentId: string; chunkCount: number }> = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${productId}/${Date.now()}-${file.name}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, buffer, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Failed to upload ${file.name}: ${uploadError.message}` },
          { status: 500 },
        );
      }

      // Create document record
      const [doc] = await db
        .insert(documentsTable)
        .values({
          productId,
          filename: file.name,
          storagePath,
          mimeType: file.type || 'application/octet-stream',
          status: 'pending',
        })
        .returning();

      // Run ingestion synchronously (extract → chunk → embed → store)
      const { chunkCount } = await ingestDocumentSync({
        documentId: doc.id,
        productId,
        storagePath,
        filename: file.name,
      });

      results.push({ filename: file.name, documentId: doc.id, chunkCount });
    }

    return NextResponse.json({ success: true, documents: results });
  } catch (error) {
    console.error('[Upload API]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
