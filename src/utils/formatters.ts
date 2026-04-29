import { PAWBUCKS_CONVERSION } from'@/lib/constants';

/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC.
 * This prevents timezone issues where dates shift back a day in US timezones.
 */
export const parseLocalDate = (dateString: string): Date => {
 // Split the date string and create a date using local timezone
 const [year, month, day] = dateString.split('-').map(Number);
 return new Date(year, month - 1, day);
};

/**
 * Format a date string (YYYY-MM-DD) for display using local timezone.
 */
export const formatLocalDate = (dateString: string, formatStr: string ='MMM d, yyyy'): string => {
 const date = parseLocalDate(dateString);
 
 // Simple formatting for common patterns
 const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 const fullMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
 
 if (formatStr ==='MMM d, yyyy') {
 return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
 }
 
 if (formatStr ==='MMMM d, yyyy') {
 return `${fullMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
 }
 
 if (formatStr ==='MM/dd/yyyy') {
 return `${String(date.getMonth() + 1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')}/${date.getFullYear()}`;
 }
 
 if (formatStr ==='yyyy-MM-dd') {
 return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 }
 
 // Default fallback
 return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

// Centralized formatting utilities
export const Formatters = {
 // Currency formatting
 currency: (amount: number, currency: string ='USD'): string => {
 return new Intl.NumberFormat('en-US', {
 style:'currency',
 currency,
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 }).format(amount);
 },

 // Number with commas
 number: (value: number): string => {
 return new Intl.NumberFormat('en-US').format(value);
 },

 // PawBucks to USD conversion (1 PawBuck = $0.001, so 1000 PawBucks = $1)
 pawBucksToUSD: (pawBucks: number): string => {
 const usd = pawBucks * 0.001;
 return Formatters.currency(usd);
 },

 // USD to PawBucks value (1 PawBuck = $0.001, so $1 = 1000 PawBucks)
 usdToPawBucks: (usd: number): number => {
 return Math.floor(usd * 1000);
 },

 // Date formatting
 date: (date: string | Date, format:'short' |'long' |'relative' ='short'): string => {
 const dateObj = typeof date ==='string' ? new Date(date) : date;

 if (format ==='relative') {
 return Formatters.relativeTime(dateObj);
 }

 const options: Intl.DateTimeFormatOptions = format ==='long'
 ? { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }
 : { year:'numeric', month:'short', day:'numeric' };

 return new Intl.DateTimeFormat('en-US', options).format(dateObj);
 },

 // Relative time (e.g.,"2 hours ago")
 relativeTime: (date: Date): string => {
 const now = new Date();
 const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

 if (diffInSeconds < 60) return'Just now';
 if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
 if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
 if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
 
 return Formatters.date(date,'short');
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
 const cleaned = phone.replace(/\D/g,'');
 const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
 if (match) {
 return `(${match[1]}) ${match[2]}-${match[3]}`;
 }
 return phone;
 },
};
