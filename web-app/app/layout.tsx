import type { Metadata } from 'next';
import { CartProvider } from '@/CartContext';
import { AuthProvider } from '@/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'CricSync',
  description: 'The All-in-One Cricket Application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
