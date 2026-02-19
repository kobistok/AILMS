import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSupabase, products as productsTable, documents as documentsTable } from '@ailms/db';
import { triggerDocumentIngestion } from '@ailms/ai';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const db = getDb();
    const supabase = getSupabase();

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
        .values({
          name: productName,
          description: productDescription ?? '',
        })
        .onConflictDoNothing()
        .returning();

      if (!product) {
        // Product already exists — look it up
        const [existing] = await db
          .select()
          .from(productsTable)
          .where(productsTable.name.eq ? productsTable.name.eq(productName) : undefined as never);
        if (!existing) {
          return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        productId = existing.id;
      } else {
        productId = product.id;
      }
    } else {
      return NextResponse.json(
        { error: 'Either productId or productName is required' },
        { status: 400 },
      );
    }

    // Process each uploaded file
    const files = formData.getAll('files') as File[];
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const results: Array<{ filename: string; documentId: string }> = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const storagePath = `${productId}/${Date.now()}-${file.name}`;

      // Upload to Supabase Storage
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

      // Trigger Inngest ingestion job
      await triggerDocumentIngestion({
        documentId: doc.id,
        productId,
        storagePath,
        filename: file.name,
      });

      results.push({ filename: file.name, documentId: doc.id });
    }

    return NextResponse.json({ success: true, documents: results });
  } catch (error) {
    console.error('[Upload API]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
