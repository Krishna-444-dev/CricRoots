'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/CartContext';

interface Product {
  _id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  seller: { name: string };
}

const CATEGORIES = ['equipment', 'apparel', 'accessories', 'other'];

export default function MarketplacePage() {
  const { addItem, items } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = category ? `?category=${category}` : '';
    fetch(`/api/products${qs}`)
      .then(r => r.json())
      .then(data => { if (data.success) setProducts(data.products); })
      .finally(() => setLoading(false));
  }, [category]);

  const handleAdd = (p: Product) => {
    addItem({ id: p._id, name: p.name, price: p.price, image: p.imageUrl ?? undefined });
    setAdded(p._id);
    setTimeout(() => setAdded(null), 1200);
  };

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Marketplace</h1>
          <div className="flex gap-3 items-center">
            <Link href="/cart" className="text-sm text-blue-600 hover:underline">
              Cart {cartCount > 0 ? `(${cartCount})` : ''}
            </Link>
            <Link href="/marketplace/new" className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition text-sm">
              + Sell an Item
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setCategory('')} className={`px-3 py-1 rounded-full text-sm font-medium ${category === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            All
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${category === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : products.length === 0 ? (
          <p className="text-gray-500">No listings yet{category ? ` in ${category}` : ''}.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map(p => (
              <div key={p._id} className="bg-white rounded-lg shadow-sm p-4">
                <Link href={`/marketplace/${p._id}`} className="font-medium text-gray-900 hover:underline">{p.name}</Link>
                <p className="text-sm text-gray-500 capitalize">{p.category} · by {p.seller?.name ?? 'Unknown'}</p>
                <p className="text-lg font-bold text-gray-900 mt-2">${p.price.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
                <button
                  onClick={() => handleAdd(p)}
                  disabled={p.stock === 0}
                  className="w-full mt-3 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition text-sm"
                >
                  {added === p._id ? 'Added!' : 'Add to Cart'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
