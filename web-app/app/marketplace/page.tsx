'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/CartContext';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

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
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        title="Marketplace"
        description="Buy and sell cricket gear with other local players."
        action={
          <div className="flex gap-3 items-center">
            <Link href="/cart" className="text-sm text-pitch-400 hover:underline">
              Cart {cartCount > 0 ? `(${cartCount})` : ''}
            </Link>
            <Link href="/marketplace/new" className={buttonVariants('primary', 'sm')}>+ Sell an Item</Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setCategory('')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category === '' ? 'bg-pitch-500 text-[#06170D]' : 'bg-surface-alt text-ink-secondary hover:text-ink'}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${category === c ? 'bg-pitch-500 text-[#06170D]' : 'bg-surface-alt text-ink-secondary hover:text-ink'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : products.length === 0 ? (
        <EmptyState icon="🛒" title={`No listings yet${category ? ` in ${category}` : ''}`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map(p => (
            <Card key={p._id}>
              <Link href={`/marketplace/${p._id}`} className="font-semibold text-ink hover:text-pitch-400 transition-colors">{p.name}</Link>
              <p className="text-sm text-ink-secondary capitalize">{p.category} · by {p.seller?.name ?? 'Unknown'}</p>
              <p className="text-lg font-bold text-ink mt-2">${p.price.toFixed(2)}</p>
              <p className="text-xs text-ink-muted">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
              <button
                onClick={() => handleAdd(p)}
                disabled={p.stock === 0}
                className={`w-full mt-3 ${buttonVariants(added === p._id ? 'secondary' : 'primary', 'sm')}`}
              >
                {added === p._id ? 'Added!' : 'Add to Cart'}
              </button>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
