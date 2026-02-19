'use client';

import { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingProductId = searchParams.get('productId');

  const [mode, setMode] = useState<'new' | 'existing'>(existingProductId ? 'existing' : 'new');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productId, setProductId] = useState(existingProductId ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    setStatus('uploading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      if (mode === 'new') {
        formData.append('productName', productName);
        formData.append('productDescription', productDescription);
      } else {
        formData.append('productId', productId);
      }
      for (const file of files) {
        formData.append('files', file);
      }

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Upload failed');
      }

      setStatus('success');
      setTimeout(() => router.push('/dashboard'), 1500);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-gray-900">Upload Content</h1>
          <p className="text-sm text-gray-500">Add PDFs or Word documents to a product agent</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
          {/* Product selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                  mode === 'new'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                New product
              </button>
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                  mode === 'existing'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Existing product
              </button>
            </div>

            {mode === 'new' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Product name (e.g. CRM Pro)"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  placeholder="Brief description (used by the AI to know when to search this product)"
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <input
                type="text"
                placeholder="Product ID"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Files</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              {files.length > 0 ? (
                <div className="space-y-1">
                  {files.map((f) => (
                    <p key={f.name} className="text-sm text-gray-700">{f.name}</p>
                  ))}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Click to select files</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX, TXT supported</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === 'uploading' || files.length === 0}
              className="bg-blue-600 text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === 'uploading' ? 'Uploading...' : status === 'success' ? 'Done!' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
