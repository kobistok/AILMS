import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getDb, getSupabase, products as productsTable, documents as documentsTable, profiles as profilesTable } from '@ailms/db';
import { createSupabaseServerClient } from '@/lib/supabase';
import { eq, sql } from 'drizzle-orm';
import { UserMenu } from '@/components/UserMenu';

async function getProductsWithMeta() {
  const db = getDb();
  return db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      description: productsTable.description,
      createdAt: productsTable.createdAt,
      docCount: sql<number>`count(distinct ${documentsTable.id})::int`,
      ownerName: profilesTable.displayName,
    })
    .from(productsTable)
    .leftJoin(documentsTable, eq(documentsTable.productId, productsTable.id))
    .leftJoin(profilesTable, sql`${productsTable.createdBy}::uuid = ${profilesTable.id}::uuid`)
    .groupBy(productsTable.id, profilesTable.displayName)
    .orderBy(productsTable.createdAt);
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const adminSupabase = getSupabase();
  const { data: profileData } = await adminSupabase
    .from('profiles')
    .select('display_name, role')
    .eq('id', user.id)
    .single();

  const profile = profileData as { display_name?: string | null; role?: string } | null;
  const products = await getProductsWithMeta();

  async function signOut() {
    'use server';
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AILMS</h1>
            <p className="text-sm text-gray-500">AI Sales Enablement</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/products/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + New Agent
            </Link>
            <UserMenu
              displayName={profile?.display_name ?? user.email ?? 'Account'}
              isAdmin={profile?.role === 'admin'}
              signOut={signOut}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900">Product Agents</h2>
          <p className="text-sm text-gray-500 mt-1">
            Each product has its own AI agent. Sales reps query all agents simultaneously via Slack.
          </p>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500 text-sm">No products yet.</p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <Link href="/products/new" className="text-blue-600 text-sm font-medium hover:underline">
                Create your first agent
              </Link>
              <span className="text-gray-300">·</span>
              <Link href="/upload" className="text-blue-600 text-sm font-medium hover:underline">
                Upload a document
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description || 'No description'}</p>
                  </div>
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link href={`/products/${product.id}`} className="text-sm text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">
                      {product.docCount} doc{product.docCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {product.ownerName && (
                    <span className="text-xs text-gray-400 truncate max-w-[100px]" title={product.ownerName}>
                      {product.ownerName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
