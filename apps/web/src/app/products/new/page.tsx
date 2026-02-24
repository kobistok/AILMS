import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getDb, getSupabase, products as productsTable } from '@ailms/db';

export default function NewProductPage() {
  async function createProduct(formData: FormData) {
    'use server';
    const name = (formData.get('name') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() ?? '';

    if (!name) return;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const adminSupabase = getSupabase();
    const { data: profileData } = await adminSupabase
      .from('profiles')
      .select('org_name')
      .eq('id', user?.id ?? '')
      .single();
    const orgName = (profileData as { org_name?: string | null } | null)?.org_name ?? null;

    const db = getDb();
    const [product] = await db
      .insert(productsTable)
      .values({ name, description, createdBy: user?.id ?? null, orgName })
      .returning();

    redirect(`/upload?productId=${product.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Dashboard
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">New Agent</h1>
            <p className="text-sm text-gray-500">Create a product agent — you can upload content later</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form action={createProduct} className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Product name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. CRM Pro"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Brief description — helps the AI know when to search this product"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Create agent
            </button>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
