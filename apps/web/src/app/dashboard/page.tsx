import Link from 'next/link';
import { getDb, products } from '@ailms/db';

async function getProducts() {
  const db = getDb();
  return db.select().from(products).orderBy(products.createdAt);
}

export default async function DashboardPage() {
  const allProducts = await getProducts();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AILMS</h1>
            <p className="text-sm text-gray-500">AI Sales Enablement</p>
          </div>
          <Link
            href="/upload"
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Upload Content
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900">Product Agents</h2>
          <p className="text-sm text-gray-500 mt-1">
            Each product has its own AI agent. Sales reps can ask about any product via Slack.
          </p>
        </div>

        {allProducts.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500 text-sm">No products yet.</p>
            <Link
              href="/upload"
              className="mt-4 inline-block text-blue-600 text-sm font-medium hover:underline"
            >
              Upload your first document to get started
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                  <Link
                    href={`/upload?productId=${product.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Add content
                  </Link>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-400">
                    Tool: search_{product.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
