export type TaxExpenseCategory = 
  | 'gas_mileage'
  | 'pet_supplies_treats'
  | 'equipment'
  | 'insurance'
  | 'marketing_advertising'
  | 'professional_services'
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
}

export const CATEGORY_LABELS: Record<TaxExpenseCategory, string> = {
  gas_mileage: 'Gas & Mileage',
  pet_supplies_treats: 'Pet Supplies & Treats',
  equipment: 'Equipment',
  insurance: 'Insurance',
  marketing_advertising: 'Marketing & Advertising',
  professional_services: 'Professional Services',
  office_supplies: 'Office Supplies',
  software_subscriptions: 'Software & Subscriptions',
  training_education: 'Training & Education',
  other: 'Other Expenses',
};

export const SCHEDULE_C_MAPPING: Record<TaxExpenseCategory, { line: string; description: string }> = {
  gas_mileage: { line: 'Line 9', description: 'Car and truck expenses' },
  pet_supplies_treats: { line: 'Line 22', description: 'Supplies' },
  equipment: { line: 'Line 13', description: 'Depreciation' },
  insurance: { line: 'Line 15', description: 'Insurance (other than health)' },
  marketing_advertising: { line: 'Line 8', description: 'Advertising' },
  professional_services: { line: 'Line 17', description: 'Legal and professional services' },
  office_supplies: { line: 'Line 18', description: 'Office expense' },
  software_subscriptions: { line: 'Line 27a', description: 'Other expenses' },
  training_education: { line: 'Line 27a', description: 'Other expenses' },
  other: { line: 'Line 27a', description: 'Other expenses' },
};
