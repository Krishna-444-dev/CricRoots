'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/CartContext';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from '@/components/payment/CheckoutForm';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_mockStripePublishableKey');

export const StripeCardElement: React.FC = () => {
  const { total } = useCart();
  const [isLoading, setIsLoading] = useState(true);
  
  // Detect if user is on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Simulate Stripe loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(timer);
    };
  }, []);
  
  const appearance = {
    theme: 'stripe',
    variables: {
      colorPrimary: '#0570de',
      colorBackground: '#ffffff',
      colorText: '#30313d',
      colorDanger: '#df1b41',
      fontFamily: 'Ideal Sans, system-ui, sans-serif',
      spacingUnit: isMobile ? '6px' : '4px', // Increased spacing for mobile
      borderRadius: '6px', // Slightly larger for better touch targets
    },
    rules: {
      '.Input': {
        padding: isMobile ? '14px 12px' : '10px 12px', // Larger input fields on mobile
        fontSize: isMobile ? '16px' : '14px', // Larger text on mobile to prevent zoom
      },
      '.Label': {
        fontSize: isMobile ? '14px' : '12px', // Larger labels on mobile
      },
      '.Error': {
        fontSize: isMobile ? '14px' : '12px', // Larger error text on mobile
        padding: isMobile ? '10px' : '8px',
      },
    }
  };
  
  const options = {
    appearance,
    loader: 'auto', // 'auto', 'always', or 'never'
  };
  
  return (
    <div className="mt-4">
      {isLoading ? (
        // Loading state with skeleton UI
        <div className="p-6 border border-gray-300 rounded-lg bg-white">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <Elements stripe={stripePromise} options={options}>
          <div className={`p-4 sm:p-6 border border-gray-300 rounded-lg bg-white ${isMobile ? 'shadow-md' : ''}`}>
            <CheckoutForm />
          </div>
        </Elements>
      )}
      
      {/* Mobile-specific security badge */}
      {isMobile && (
        <div className="mt-4 flex items-center justify-center bg-gray-50 p-3 rounded-lg">
          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="ml-2 text-sm text-gray-600 font-medium">Secure Payment</span>
        </div>
      )}
    </div>
  );
};

export default StripeCardElement;
