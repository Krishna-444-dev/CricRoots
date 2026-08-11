'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

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
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-ink mb-2">Sell an Item</h1>
        <p className="text-sm text-ink-secondary mb-6">
          Buyers pay you directly (cash, bank transfer, or in person) once you confirm the order — there&apos;s no online payment processing yet.
        </p>
        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Item Name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} capitalize`}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Price ($)</label>
              <input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Stock</label>
              <input type="number" min="0" required value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
            </div>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Publishing...' : 'List Item'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
