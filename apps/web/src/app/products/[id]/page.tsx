import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getDb, getSupabase, products as productsTable, documents as documentsTable, chunks as chunksTable } from '@ailms/db';
import { eq, sql } from 'drizzle-orm';

async function getProduct(id: string) {
  const db = getDb();
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  return product ?? null;
}

async function getDocumentsWithChunkCounts(productId: string) {
  const db = getDb();
  return db
    .select({
      id: documentsTable.id,
      filename: documentsTable.filename,
      storagePath: documentsTable.storagePath,
      status: documentsTable.status,
      errorMessage: documentsTable.errorMessage,
      createdAt: documentsTable.createdAt,
      chunkCount: sql<number>`count(${chunksTable.id})::int`,
    })
    .from(documentsTable)
    .leftJoin(chunksTable, eq(chunksTable.documentId, documentsTable.id))
    .where(eq(documentsTable.productId, productId))
    .groupBy(documentsTable.id)
    .orderBy(documentsTable.createdAt);
}

const statusConfig = {
  completed: { label: 'Ready', className: 'bg-green-100 text-green-700' },
  processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const product = await getProduct(id);
  if (!product) notFound();

  const documents = await getDocumentsWithChunkCounts(id);

  async function updateProduct(formData: FormData) {
    'use server';
    const name = (formData.get('name') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() ?? '';
    if (!name) return;
    const db = getDb();
    await db.update(productsTable).set({ name, description }).where(eq(productsTable.id, id));
    redirect(`/products/${id}`);
  }

  async function deleteDocument(formData: FormData) {
    'use server';
    const docId = formData.get('documentId') as string;
    const storagePath = formData.get('storagePath') as string;
    // Remove file from storage
    const adminSupabase = getSupabase();
    await adminSupabase.storage.from('documents').remove([storagePath]);
    // Delete record — chunks cascade
    const db = getDb();
    await db.delete(documentsTable).where(eq(documentsTable.id, docId));
    redirect(`/products/${id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Edit Agent</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Agent details */}
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Agent details</h2>
          <form action={updateProduct} className="space-y-3">
            <input
              name="name"
              type="text"
              defaultValue={product.name}
              required
              placeholder="Product name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              name="description"
              defaultValue={product.description}
              rows={2}
              placeholder="Description — helps the AI know when to search this product"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Save changes
            </button>
          </form>
        </section>

        {/* Documents */}
        <section className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">
              Documents
              <span className="ml-1.5 text-gray-400 font-normal">({documents.length})</span>
            </h2>
            <Link
              href={`/upload?productId=${id}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Add files
            </Link>
          </div>

          {documents.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm text-gray-500">No documents yet.</p>
              <Link
                href={`/upload?productId=${id}`}
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                Upload your first file
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {documents.map((doc) => {
                const status = statusConfig[doc.status as keyof typeof statusConfig] ?? statusConfig.pending;
                return (
                  <li key={doc.id} className="flex items-center justify-between px-6 py-3 gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {doc.chunkCount} chunk{doc.chunkCount !== 1 ? 's' : ''}
                        {' · '}
                        {new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {doc.status === 'failed' && doc.errorMessage && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{doc.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      <form action={deleteDocument}>
                        <input type="hidden" name="documentId" value={doc.id} />
                        <input type="hidden" name="storagePath" value={doc.storagePath} />
                        <button
                          type="submit"
                          title="Remove file"
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

      </main>
    </div>
  );
}
