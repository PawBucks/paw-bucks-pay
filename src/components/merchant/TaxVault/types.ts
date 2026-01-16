export type TaxExpenseCategory = 
  | 'inventory_supplies'
  | 'specialized_equipment'
  | 'professional_services'
  | 'merchant_market'
  | 'gas_mileage'
  | 'pet_supplies_treats'
  | 'equipment'
  | 'insurance'
  | 'marketing_advertising'
  | 'office_supplies'
  | 'software_subscriptions'
  | 'training_education'
  | 'other';

export interface TaxExpense {
  id: string;
  merchant_id: string;
  category: TaxExpenseCategory;
  amount: number;
  description: string | null;
  expense_date: string;
  receipt_url: string | null;
  vendor_name: string | null;
  tax_year: number;
  created_at: string;
  updated_at: string;
  // New fields for savings tracking
  original_price: number | null;
  savings_amount: number | null;
  is_auto_logged: boolean;
  source_purchase_id: string | null;
}

// IRS-friendly category labels with examples
export const CATEGORY_LABELS: Record<TaxExpenseCategory, string> = {
  inventory_supplies: 'Inventory & Supplies',
  specialized_equipment: 'Specialized Equipment',
  professional_services: 'Professional Services',
  merchant_market: 'Merchant Market Services',
  gas_mileage: 'Gas & Mileage',
  pet_supplies_treats: 'Pet Supplies & Treats',
  equipment: 'Equipment',
  insurance: 'Insurance',
  marketing_advertising: 'Marketing & Advertising',
  office_supplies: 'Office Supplies',
  software_subscriptions: 'Software & Subscriptions',
  training_education: 'Training & Education',
  other: 'Other Expenses',
};

// Category descriptions with examples for user guidance
export const CATEGORY_DESCRIPTIONS: Record<TaxExpenseCategory, string> = {
  inventory_supplies: 'Professional shampoos, leashes, treats, bulk food, retail inventory',
  specialized_equipment: 'Grooming tables, high-velocity dryers, kennels, medical equipment',
  professional_services: 'Veterinary consultant fees, insurance premiums, certifications, legal',
  merchant_market: 'PawBucks Merchant Market services (auto-logged with savings)',
  gas_mileage: 'Vehicle fuel, mileage for business trips, travel expenses',
  pet_supplies_treats: 'Supplies and treats for business use',
  equipment: 'General business equipment and tools',
  insurance: 'Business insurance, liability coverage',
  marketing_advertising: 'Advertising, promotional materials, social media ads',
  office_supplies: 'Office materials, stationery, printer supplies',
  software_subscriptions: 'Business software, apps, online services',
  training_education: 'Courses, certifications, professional development',
  other: 'Miscellaneous business expenses',
};

// IRS Schedule C line mapping
export const SCHEDULE_C_MAPPING: Record<TaxExpenseCategory, { line: string; description: string }> = {
  inventory_supplies: { line: 'Line 36', description: 'Cost of goods sold / Supplies' },
  specialized_equipment: { line: 'Line 13', description: 'Depreciation and Section 179' },
  professional_services: { line: 'Line 17', description: 'Legal and professional services' },
  merchant_market: { line: 'Line 8', description: 'Advertising / Line 27a Other' },
  gas_mileage: { line: 'Line 9', description: 'Car and truck expenses' },
  pet_supplies_treats: { line: 'Line 22', description: 'Supplies' },
  equipment: { line: 'Line 13', description: 'Depreciation' },
  insurance: { line: 'Line 15', description: 'Insurance (other than health)' },
  marketing_advertising: { line: 'Line 8', description: 'Advertising' },
  office_supplies: { line: 'Line 18', description: 'Office expense' },
  software_subscriptions: { line: 'Line 27a', description: 'Other expenses' },
  training_education: { line: 'Line 27a', description: 'Other expenses' },
  other: { line: 'Line 27a', description: 'Other expenses' },
};

// Priority order for displaying categories (most common first)
export const CATEGORY_PRIORITY: TaxExpenseCategory[] = [
  'inventory_supplies',
  'specialized_equipment',
  'professional_services',
  'merchant_market',
  'marketing_advertising',
  'insurance',
  'gas_mileage',
  'equipment',
  'software_subscriptions',
  'training_education',
  'pet_supplies_treats',
  'office_supplies',
  'other',
];
