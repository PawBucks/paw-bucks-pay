import { PAWBUCKS_CONVERSION } from '@/lib/constants';

// Centralized formatting utilities
export const Formatters = {
  // Currency formatting
  currency: (amount: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  // Number with commas
  number: (value: number): string => {
    return new Intl.NumberFormat('en-US').format(value);
  },

  // PawBucks to USD conversion
  pawBucksToUSD: (pawBucks: number): string => {
    const usd = pawBucks / PAWBUCKS_CONVERSION.USD_CONVERSION;
    return Formatters.currency(usd);
  },

  // USD to PawBucks conversion
  usdToPawBucks: (usd: number): number => {
    return Math.floor(usd * PAWBUCKS_CONVERSION.EARN_RATE);
  },

  // Date formatting
  date: (date: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (format === 'relative') {
      return Formatters.relativeTime(dateObj);
    }

    const options: Intl.DateTimeFormatOptions = format === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' };

    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  },

  // Relative time (e.g., "2 hours ago")
  relativeTime: (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return Formatters.date(date, 'short');
  },

  // Percentage
  percentage: (value: number, decimals: number = 0): string => {
    return `${value.toFixed(decimals)}%`;
  },

  // Truncate text
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
  },

  // Phone number
  phone: (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  },
};
