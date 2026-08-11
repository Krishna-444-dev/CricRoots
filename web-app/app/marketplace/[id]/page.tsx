'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { useCart } from '@/CartContext';
import { apiFetch } from '@/lib/apiFetch';

interface Product {
  _id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
  seller: { _id: string; name: string };
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then(r => r.json())
      .then(data => { if (data.success) setProduct(data.product); })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Remove this listing?')) return;
    const res = await apiFetch(`/api/products/${params.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) router.push('/marketplace');
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!product) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Listing not found.</p></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/marketplace" className="text-sm text-blue-600 hover:underline">&larr; Back to marketplace</Link>
        <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-sm text-gray-500 capitalize mt-1">{product.category} · sold by {product.seller?.name}</p>
          <p className="text-2xl font-bold text-gray-900 mt-4">${product.price.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mb-4">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>
          {product.description && <p className="text-gray-700 whitespace-pre-wrap mb-6">{product.description}</p>}

          <button
            onClick={() => { addItem({ id: product._id, name: product.name, price: product.price, image: product.imageUrl ?? undefined }); setAdded(true); }}
            disabled={product.stock === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {added ? 'Added to cart' : 'Add to Cart'}
          </button>

          {user?.id === product.seller?._id && (
            <button onClick={handleDelete} className="mt-4 text-sm text-red-600 hover:underline">
              Remove listing
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
