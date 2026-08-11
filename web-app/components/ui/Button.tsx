'use client';

import React from 'react';
import { buttonVariants, ButtonVariant, ButtonSize } from './buttonStyles';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return <button className={buttonVariants(variant, size, className)} {...props} />;
}
