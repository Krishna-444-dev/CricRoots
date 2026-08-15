'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { useCart } from '@/CartContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

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
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!product) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Listing not found.</p></main>;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/marketplace" className="text-sm text-pitch-400 hover:underline">&larr; Back to marketplace</Link>
      <Card padding="lg" className="mt-4">
        <h1 className="text-2xl font-bold text-ink">{product.name}</h1>
        <p className="text-sm text-ink-secondary capitalize mt-1">{product.category} · sold by {product.seller?.name}</p>
        <p className="text-2xl font-bold text-pitch-400 mt-4">${product.price.toFixed(2)}</p>
        <p className="text-sm text-ink-muted mb-4">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</p>
        {product.description && <p className="text-ink-secondary whitespace-pre-wrap mb-6">{product.description}</p>}

        <Button
          onClick={() => { addItem({ id: product._id, name: product.name, price: product.price, image: product.imageUrl ?? undefined }); setAdded(true); }}
          disabled={product.stock === 0}
          className="w-full"
        >
          {added ? 'Added to cart' : 'Add to Cart'}
        </Button>

        {/* Boolean(...) on both sides - a bare equality reads as true for a logged-out viewer
            on a product with no seller populated, since undefined === undefined. */}
        {Boolean(user?.id) && Boolean(product.seller?._id) && user?.id === product.seller?._id && (
          <button onClick={handleDelete} className="mt-4 text-sm text-wicket-500 hover:text-wicket-400 transition-colors">
            Remove listing
          </button>
        )}
      </Card>
    </main>
  );
}
