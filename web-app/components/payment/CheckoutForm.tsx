'use client';

import React, { useState, useEffect } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { useRouter } from 'next/navigation';

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    address: {
      line1: '',
      city: '',
      state: '',
      postal_code: '',
    },
  });

  // Form validation state
  const [formErrors, setFormErrors] = useState({
    name: '',
    email: '',
    line1: '',
    city: '',
    state: '',
    postal_code: '',
  });

  // Validate email format
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Validate form fields for current step
  const validateCurrentStep = () => {
    let isValid = true;
    const newErrors = { ...formErrors };

    if (currentStep === 1) {
      if (!billingDetails.name.trim()) {
        newErrors.name = 'Name is required';
        isValid = false;
      } else {
        newErrors.name = '';
      }

      if (!billingDetails.email.trim()) {
        newErrors.email = 'Email is required';
        isValid = false;
      } else if (!validateEmail(billingDetails.email)) {
        newErrors.email = 'Please enter a valid email';
        isValid = false;
      } else {
        newErrors.email = '';
      }
    } else if (currentStep === 2) {
      if (!billingDetails.address.line1.trim()) {
        newErrors.line1 = 'Address is required';
        isValid = false;
      } else {
        newErrors.line1 = '';
      }

      if (!billingDetails.address.city.trim()) {
        newErrors.city = 'City is required';
        isValid = false;
      } else {
        newErrors.city = '';
      }

      if (!billingDetails.address.state.trim()) {
        newErrors.state = 'State is required';
        isValid = false;
      } else {
        newErrors.state = '';
      }

      if (!billingDetails.address.postal_code.trim()) {
        newErrors.postal_code = 'ZIP Code is required';
        isValid = false;
      } else {
        newErrors.postal_code = '';
      }
    }

    setFormErrors(newErrors);
    return isValid;
  };

  // Handle next step navigation
  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle previous step navigation
  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet. Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    if (error) {
      elements.getElement('card').focus();
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    setProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        window.clientSecret, // This should be set in the parent component
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: billingDetails,
          },
        }
      );

      if (error) {
        setError(error.message);
        setProcessing(false);
      } else if (paymentIntent.status === 'succeeded') {
        // Payment successful, redirect to confirmation page
        router.push(`/checkout/confirmation?payment_intent=${paymentIntent.id}`);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An unexpected error occurred. Please try again.');
      setProcessing(false);
    }
  };

  const handlePayPalApprove = async (data, actions) => {
    setProcessing(true);
    try {
      const details = await actions.order.capture();
      // Send the PayPal details to your server
      const response = await fetch('/api/confirm-paypal-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderID: data.orderID,
          details: details,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        router.push(`/checkout/confirmation?order_id=${result.orderNumber}`);
      } else {
        setError(result.error || 'Failed to process PayPal payment');
        setProcessing(false);
      }
    } catch (err) {
      console.error('PayPal error:', err);
      setError('An unexpected error occurred with PayPal. Please try again.');
      setProcessing(false);
    }
  };

  // Detect if user is on mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return (
    <div>
      {/* Payment method selection */}
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-3">Payment Method</h3>
        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0">
          <label className="flex items-center p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 touch-manipulation">
            <input
              type="radio"
              name="paymentMethod"
              value="card"
              checked={paymentMethod === 'card'}
              onChange={() => setPaymentMethod('card')}
              className="form-radio h-5 w-5 text-blue-600"
            />
            <span className="ml-3 text-gray-700 font-medium">Credit/Debit Card</span>
          </label>
          
          <label className="flex items-center p-4 border rounded-lg cursor-pointer transition-colors hover:bg-gray-50 touch-manipulation">
            <input
              type="radio"
              name="paymentMethod"
              value="paypal"
              checked={paymentMethod === 'paypal'}
              onChange={() => setPaymentMethod('paypal')}
              className="form-radio h-5 w-5 text-blue-600"
            />
            <span className="ml-3 text-gray-700 font-medium">PayPal</span>
          </label>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Credit Card Payment Form */}
      {paymentMethod === 'card' && (
        <div>
          {/* Progress indicator for multi-step form (mobile only) */}
          {isMobile && (
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-500">
                  Step {currentStep} of 3
                </div>
                <div className="w-2/3 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${(currentStep / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Personal Information (Mobile) */}
            {isMobile && currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Personal Information</h3>
                
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name on Card *
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={billingDetails.name}
                    onChange={(e) => {
                      setBillingDetails({ ...billingDetails, name: e.target.value });
                      if (formErrors.name) setFormErrors({...formErrors, name: ''});
                    }}
                    className={`w-full px-4 py-3 border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    required
                    value={billingDetails.email}
                    onChange={(e) => {
                      setBillingDetails({ ...billingDetails, email: e.target.value });
                      if (formErrors.email) setFormErrors({...formErrors, email: ''});
                    }}
                    className={`w-full px-4 py-3 border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="w-full bg-blue-600 text-white text-center py-3 px-4 rounded-lg hover:bg-blue-700 transition touch-manipulation"
                  >
                    Continue to Billing Address
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Billing Address (Mobile) */}
            {isMobile && currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Billing Address</h3>
                
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    id="address"
                    type="text"
                    placeholder="123 Main St"
                    required
                    value={billingDetails.address.line1}
                    onChange={(e) => {
                      setBillingDetails({
                        ...billingDetails,
                        address: { ...billingDetails.address, line1: e.target.value },
                      });
                      if (formErrors.line1) setFormErrors({...formErrors, line1: ''});
                    }}
                    className={`w-full px-4 py-3 border ${formErrors.line1 ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base`}
                  />
                  {formErrors.line1 && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.line1}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    id="city"
                    type="text"
                    placeholder="New York"
                    required
                    value={billingDetails.address.city}
                    onChange={(e) => {
                      setBillingDetails({
                        ...billingDetails,
                        address: { ...billingDetails.address, city: e.target.value },
                      });
                      if (formErrors.city) setFormErrors({...formErrors, city: ''});
                    }}
                    className={`w-full px-4 py-3 border ${formErrors.city ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base`}
                  />
                  {formErrors.city && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.city}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                      State *
                    </label>
                    <input
                      id="state"
                      type="text"
                      placeholder="NY"
                      required
                      value={billingDetails.address.state}
                      onChange={(e) => {
                        setBillingDetails({
                          ...billingDetails,
                          address: { ...billingDetails.address, state: e.target.value },
                        });
                        if (formErrors.state) setFormErrors({...formErrors, state: ''});
                      }}
                      className={`w-full px-4 py-3 border ${formErrors.state ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base`}
                    />
                    {formErrors.state && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.state}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code *
                    </label>
                    <input
                      id="postal_code"
                      type="text"
                      placeholder="10001"
                      required
                      value={billingDetails.address.postal_code}
                      onChange={(e) => {
                        setBillingDetails({
                          ...billingDetails,
                          address: { ...billingDetails.address, postal_code: e.target.value },
                        });
                        if (formErrors.postal_code) setFormErrors({...formErrors, postal_code: ''});
                      }}
                      className={`w-full px-4 py-3 border ${formErrors.postal_code ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base`}
                    />
                    {formErrors.postal_code && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.postal_code}</p>
                    )}
                  </div<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>