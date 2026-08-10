'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PlayerRegistrationFormProps {
  onSubmit: (playerData: any) => void;
  initialData?: any;
}

const PlayerRegistrationForm: React.FC<PlayerRegistrationFormProps> = ({
  onSubmit,
  initialData
}) => {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    dateOfBirth: initialData?.dateOfBirth || '',
    gender: initialData?.gender || '',
    address: {
      street: initialData?.address?.street || '',
      city: initialData?.address?.city || '',
      state: initialData?.address?.state || '',
      zipCode: initialData?.address?.zipCode || '',
      country: initialData?.address?.country || 'United States'
    },
    cricketInfo: {
      playingRole: initialData?.cricketInfo?.playingRole || '',
      battingStyle: initialData?.cricketInfo?.battingStyle || '',
      bowlingStyle: initialData?.cricketInfo?.bowlingStyle || '',
      experience: initialData?.cricketInfo?.experience || '',
    },
    emergencyContact: {
      name: initialData?.emergencyContact?.name || '',
      relationship: initialData?.emergencyContact?.relationship || '',
      phone: initialData?.emergencyContact?.phone || '',
    },
    profileImage: null as File | null,
    termsAccepted: initialData?.termsAccepted || false
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(initialData?.profileImageUrl || null);
  const [currentSection, setCurrentSection] = useState<number>(1);
  const totalSections = 4;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (name.includes('.')) {
      const [section, field] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section as keyof typeof prev],
          [field]: type === 'checkbox' 
            ? (e.target as HTMLInputElement).checked 
            : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' 
          ? (e.target as HTMLInputElement).checked 
          : value
      }));
    }
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({
        ...prev,
        profileImage: file
      }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreviewImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const validateSection = (section: number) => {
    const newErrors: Record<string, string> = {};
    
    if (section === 1) {
      // Personal Information validation
      if (!formData.firstName.trim()) newErrors['firstName'] = 'First name is required';
      if (!formData.lastName.trim()) newErrors['lastName'] = 'Last name is required';
      if (!formData.email.trim()) newErrors['email'] = 'Email is required';
      if (!formData.phone.trim()) newErrors['phone'] = 'Phone number is required';
      if (!formData.dateOfBirth) newErrors['dateOfBirth'] = 'Date of birth is required';
      if (!formData.gender) newErrors['gender'] = 'Gender is required';
      
      // Email validation
      if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors['email'] = 'Please enter a valid email address';
      }
      
      // Phone validation
      if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
        newErrors['phone'] = 'Please enter a valid 10-digit phone number';
      }
    } else if (section === 2) {
      // Address validation
      if (!formData.address.street.trim()) newErrors['address.street'] = 'Street address is required';
      if (!formData.address.city.trim()) newErrors['address.city'] = 'City is required';
      if (!formData.address.state.trim()) newErrors['address.state'] = 'State is required';
      if (!formData.address.zipCode.trim()) newErrors['address.zipCode'] = 'ZIP code is required';
      
      // ZIP code validation
      if (formData.address.zipCode && !/^\d{5}(-\d{4})?$/.test(formData.address.zipCode)) {
        newErrors['address.zipCode'] = 'Please enter a valid ZIP code';
      }
    } else if (section === 3) {
      // Cricket Info validation
      if (!formData.cricketInfo.playingRole) newErrors['cricketInfo.playingRole'] = 'Playing role is required';
    } else if (section === 4) {
      // Emergency Contact validation
      if (!formData.emergencyContact.name.trim()) newErrors['emergencyContact.name'] = 'Emergency contact name is required';
      if (!formData.emergencyContact.phone.trim()) newErrors['emergencyContact.phone'] = 'Emergency contact phone is required';
      if (!formData.termsAccepted) newErrors['termsAccepted'] = 'You must accept the terms and conditions';
      
      // Emergency contact phone validation
      if (formData.emergencyContact.phone && !/^\d{10}$/.test(formData.emergencyContact.phone.replace(/\D/g, ''))) {
        newErrors['emergencyContact.phone'] = 'Please enter a valid 10-digit phone number';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleNextSection = () => {
    if (validateSection(currentSection)) {
      setCurrentSection(prev => Math.min(prev + 1, totalSections));
      window.scrollTo(0, 0);
    } else {
      // Scroll to first error
      const firstErrorField = document.querySelector('[aria-invalid="true"]');
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };
  
  const handlePrevSection = () => {
    setCurrentSection(prev => Math.max(prev - 1, 1));
    window.scrollTo(0, 0);
  };
  
  const validateForm = () => {
    // Validate all sections
    let allValid = true;
    let combinedErrors: Record<string, string> = {};
    
    for (let i = 1; i <= totalSections; i++) {
      const currentSection = i;
      const newErrors: Record<string, string> = {};
      
      if (currentSection === 1) {
        // Personal Information validation
        if (!formData.firstName.trim()) newErrors['firstName'] = 'First name is required';
        if (!formData.lastName.trim()) newErrors['lastName'] = 'Last name is required';
        if (!formData.email.trim()) newErrors['email'] = 'Email is required';
        if (!formData.phone.trim()) newErrors['phone'] = 'Phone number is required';
        if (!formData.dateOfBirth) newErrors['dateOfBirth'] = 'Date of birth is required';
        if (!formData.gender) newErrors['gender'] = 'Gender is required';
        
        // Email validation
        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
          newErrors['email'] = 'Please enter a valid email address';
        }
        
        // Phone validation
        if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
          newErrors['phone'] = 'Please enter a valid 10-digit phone number';
        }
      } else if (currentSection === 2) {
        // Address validation
        if (!formData.address.street.trim()) newErrors['address.street'] = 'Street address is required';
        if (!formData.address.city.trim()) newErrors['address.city'] = 'City is required';
        if (!formData.address.state.trim()) newErrors['address.state'] = 'State is required';
        if (!formData.address.zipCode.trim()) newErrors['address.zipCode'] = 'ZIP code is required';
        
        // ZIP code validation
        if (formData.address.zipCode && !/^\d{5}(-\d{4})?$/.test(formData.address.zipCode)) {
          newErrors['address.zipCode'] = 'Please enter a valid ZIP code';
        }
      } else if (currentSection === 3) {
        // Cricket Info validation
        if (!formData.cricketInfo.playingRole) newErrors['cricketInfo.playingRole'] = 'Playing role is required';
      } else if (currentSection === 4) {
        // Emergency Contact validation
        if (!formData.emergencyContact.name.trim()) newErrors['emergencyContact.name'] = 'Emergency contact name is required';
        if (!formData.emergencyContact.phone.trim()) newErrors['emergencyContact.phone'] = 'Emergency contact phone is required';
        if (!formData.termsAccepted) newErrors['termsAccepted'] = 'You must accept the terms and conditions';
        
        // Emergency contact phone validation
        if (formData.emergencyContact.phone && !/^\d{10}$/.test(formData.emergencyContact.phone.replace(/\D/g, ''))) {
          newErrors['emergencyContact.phone'] = 'Please enter a valid 10-digit phone number';
        }
      }
      
      if (Object.keys(newErrors).length > 0) {
        allValid = false;
        combinedErrors = { ...combinedErrors, ...newErrors };
      }
    }
    
    setErrors(combinedErrors);
    return allValid;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Set section to the first one with errors
      if (errors.firstName || errors.lastName || errors.email || errors.phone || errors.dateOfBirth || errors.gender) {
        setCurrentSection(1);
      } else if (errors['address.street'] || errors['address.city'] || errors['address.state'] || errors['address.zipCode']) {
        setCurrentSection(2);
      } else if (errors['cricketInfo.playingRole']) {
        setCurrentSection(3);
      } else {
        setCurrentSection(4);
      }
      
      // Scroll to first error
      setTimeout(() => {
        const firstErrorField = document.querySelector('[aria-invalid="true"]');
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // In a real implementation, this would send to an API
      // For now, we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSubmit(formData);
      
      // Redirect to success page or profile page
      router.push('/registration-success');
    } catch (error) {
      console.error('Error submitting form:', error);
      setErrors({
        form: 'An error occurred while submitting the form. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Progress indicator
  const ProgressBar = () => (
    <div className="mb-6">
      <div className="flex justify-between mb-2">
        {Array.from({ length: totalSections }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              if (i + 1 < currentSection) {
                setCurrentSection(i + 1);
              } else if (i + 1 === currentSection + 1) {
                handleNextSection();
              }
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium touch-manipulation
              ${i + 1 < currentSection 
                ? 'bg-green-500 text-white' 
                : i + 1 === currentSection 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'}`}
            disabled={i + 1 > currentSection}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
          style={{ width: `${(currentSection / totalSections) * 100}%` }}
        ></div>
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>Personal Info</span>
        <span>Address</span>
        <span>Cricket Info</span>
        <span>Emergency</span>
      </div>
    </div>
  );
  
  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Player Registration</h2>
      
      {errors.form && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <p>{errors.form}</p>
        </div>
      )}
      
      <ProgressBar />
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Personal Information */}
        {currentSection === 1 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors.firstName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors.firstName ? 'true' : 'false'}
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors.lastName ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors.lastName ? 'true' : 'false'}
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors.email ? 'true' : 'false'}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="1234567890"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors.phone ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors.phone ? 'true' : 'false'}
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>

              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors.dateOfBirth ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors.dateOfBirth ? 'true' : 'false'}
                />
                {errors.dateOfBirth && (
                  <p className="mt-1 text-sm text-red-600">{errors.dateOfBirth}</p>
                )}
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors.gender ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors.gender ? 'true' : 'false'}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors.gender && (
                  <p className="mt-1 text-sm text-red-600">{errors.gender}</p>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleNextSection}
                  className="w-full bg-blue-600 text-white text-center py-3 px-4 rounded-md hover:bg-blue-700 transition touch-manipulation"
                >
                  Continue to Address
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Address */}
        {currentSection === 2 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Address</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="address.street" className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="address.street"
                  name="address.street"
                  value={formData.address.street}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors['address.street'] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors['address.street'] ? 'true' : 'false'}
                />
                {errors['address.street'] && (
                  <p className="mt-1 text-sm text-red-600">{errors['address.street']}</p>
                )}
              </div>

              <div>
                <label htmlFor="address.city" className="block text-sm font-medium text-gray-700 mb-1">
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="address.city"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors['address.city'] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors['address.city'] ? 'true' : 'false'}
                />
                {errors['address.city'] && (
                  <p className="mt-1 text-sm text-red-600">{errors['address.city']}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="address.state" className="block text-sm font-medium text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="address.state"
                    name="address.state"
                    value={formData.address.state}
                    onChange={handleChange}
                    className={`w-full px-3 py-3 border ${errors['address.state'] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                    aria-invalid={errors['address.state'] ? 'true' : 'false'}
                  />
                  {errors['address.state'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['address.state']}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="address.zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="address.zipCode"
                    name="address.zipCode"
                    value={formData.address.zipCode}
                    onChange={handleChange}
                    className={`w-full px-3 py-3 border ${errors['address.zipCode'] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                    aria-invalid={errors['address.zipCode'] ? 'true' : 'false'}
                  />
                  {errors['address.zipCode'] && (
                    <p className="mt-1 text-sm text-red-600">{errors['address.zipCode']}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="address.country" className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <input
                  type="text"
                  id="address.country"
                  name="address.country"
                  value={formData.address.country}
                  onChange={handleChange}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handlePrevSection}
                  className="flex-1 border border-gray-300 text-gray-700 text-center py-3 px-4 rounded-md hover:bg-gray-50 transition touch-manipulation"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextSection}
                  className="flex-1 bg-blue-600 text-white text-center py-3 px-4 rounded-md hover:bg-blue-700 transition touch-manipulation"
                >
                  Continue to Cricket Info
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Cricket Info */}
        {currentSection === 3 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cricket Info</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="cricketInfo.playingRole" className="block text-sm font-medium text-gray-700 mb-1">
                  Playing Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="cricketInfo.playingRole"
                  name="cricketInfo.playingRole"
                  value={formData.cricketInfo.playingRole}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors['cricketInfo.playingRole'] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors['cricketInfo.playingRole'] ? 'true' : 'false'}
                >
                  <option value="">Select playing role</option>
                  <option value="Batsman">Batsman</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All-rounder">All-rounder</option>
                  <option value="Wicket-keeper">Wicket-keeper</option>
                </select>
                {errors['cricketInfo.playingRole'] && (
                  <p className="mt-1 text-sm text-red-600">{errors['cricketInfo.playingRole']}</p>
                )}
              </div>

              <div>
                <label htmlFor="cricketInfo.battingStyle" className="block text-sm font-medium text-gray-700 mb-1">
                  Batting Style
                </label>
                <select
                  id="cricketInfo.battingStyle"
                  name="cricketInfo.battingStyle"
                  value={formData.cricketInfo.battingStyle}
                  onChange={handleChange}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                >
                  <option value="">Select batting style</option>
                  <option value="Right-hand">Right-hand</option>
                  <option value="Left-hand">Left-hand</option>
                </select>
              </div>

              <div>
                <label htmlFor="cricketInfo.bowlingStyle" className="block text-sm font-medium text-gray-700 mb-1">
                  Bowling Style
                </label>
                <select
                  id="cricketInfo.bowlingStyle"
                  name="cricketInfo.bowlingStyle"
                  value={formData.cricketInfo.bowlingStyle}
                  onChange={handleChange}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                >
                  <option value="">Select bowling style</option>
                  <option value="Right-arm Fast">Right-arm Fast</option>
                  <option value="Right-arm Spin">Right-arm Spin</option>
                  <option value="Left-arm Fast">Left-arm Fast</option>
                  <option value="Left-arm Spin">Left-arm Spin</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div>
                <label htmlFor="cricketInfo.experience" className="block text-sm font-medium text-gray-700 mb-1">
                  Years of Experience
                </label>
                <input
                  type="number"
                  min="0"
                  id="cricketInfo.experience"
                  name="cricketInfo.experience"
                  value={formData.cricketInfo.experience}
                  onChange={handleChange}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handlePrevSection}
                  className="flex-1 border border-gray-300 text-gray-700 text-center py-3 px-4 rounded-md hover:bg-gray-50 transition touch-manipulation"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextSection}
                  className="flex-1 bg-blue-600 text-white text-center py-3 px-4 rounded-md hover:bg-blue-700 transition touch-manipulation"
                >
                  Continue to Emergency Contact
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Emergency Contact */}
        {currentSection === 4 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="emergencyContact.name" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="emergencyContact.name"
                  name="emergencyContact.name"
                  value={formData.emergencyContact.name}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors['emergencyContact.name'] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors['emergencyContact.name'] ? 'true' : 'false'}
                />
                {errors['emergencyContact.name'] && (
                  <p className="mt-1 text-sm text-red-600">{errors['emergencyContact.name']}</p>
                )}
              </div>

              <div>
                <label htmlFor="emergencyContact.relationship" className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  id="emergencyContact.relationship"
                  name="emergencyContact.relationship"
                  placeholder="e.g. Parent, Spouse, Sibling"
                  value={formData.emergencyContact.relationship}
                  onChange={handleChange}
                  className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
                />
              </div>

              <div>
                <label htmlFor="emergencyContact.phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="emergencyContact.phone"
                  name="emergencyContact.phone"
                  placeholder="1234567890"
                  value={formData.emergencyContact.phone}
                  onChange={handleChange}
                  className={`w-full px-3 py-3 border ${errors['emergencyContact.phone'] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base`}
                  aria-invalid={errors['emergencyContact.phone'] ? 'true' : 'false'}
                />
                {errors['emergencyContact.phone'] && (
                  <p className="mt-1 text-sm text-red-600">{errors['emergencyContact.phone']}</p>
                )}
              </div>

              <div>
                <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  {previewImage && (
                    <img
                      src={previewImage}
                      alt="Profile preview"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  )}
                  <input
                    type="file"
                    id="profileImage"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>
              </div>

              <div className="flex items-start">
                <input
                  type="checkbox"
                  id="termsAccepted"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onChange={handleChange}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  aria-invalid={errors.termsAccepted ? 'true' : 'false'}
                />
                <label htmlFor="termsAccepted" className="ml-2 text-sm text-gray-700">
                  I accept the terms and conditions <span className="text-red-500">*</span>
                </label>
              </div>
              {errors.termsAccepted && (
                <p className="text-sm text-red-600">{errors.termsAccepted}</p>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handlePrevSection}
                  className="flex-1 border border-gray-300 text-gray-700 text-center py-3 px-4 rounded-md hover:bg-gray-50 transition touch-manipulation"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white text-center py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition touch-manipulation"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default PlayerRegistrationForm;