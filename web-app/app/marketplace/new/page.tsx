'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

const CATEGORIES = ['equipment', 'apparel', 'accessories', 'other'];

export default function NewListingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('equipment');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && !user) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({ name, description, category, price: parseFloat(price), stock: parseInt(stock, 10) }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/marketplace/${data.product._id}`);
      } else {
        setError(data.message || 'Could not create listing');
      }
    } catch {
      setError('Could not reach the CricSync server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sell an Item</h1>
        <p className="text-sm text-gray-500 mb-6">
          Buyers pay you directly (cash, bank transfer, or in person) once you confirm the order - there's no online payment processing yet.
        </p>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-md" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-md capitalize">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
              <input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
              <input type="number" min="0" required value={stock} onChange={(e) => setStock(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-md" />
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition">
            {isSubmitting ? 'Publishing...' : 'List Item'}
          </button>
        </form>
      </div>
    </main>
  );
}
