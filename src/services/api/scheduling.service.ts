import { supabase } from"@/integrations/supabase/client";

// Types based on database schema
export type ServiceCategory = 
 |'daycare'
 |'boarding'
 |'grooming'
 |'walking'
 |'training'
 |'veterinary'
 |'pet_sitting'
 |'other';

export type BookingStatus = 
 |'pending'
 |'confirmed'
 |'cancelled'
 |'completed'
 |'no_show';

export type PaymentType = 
 |'pay_at_booking'
 |'pay_at_service'
 |'both';

export interface MerchantService {
 id: string;
 merchant_id: string;
 name: string;
 description?: string;
 category: ServiceCategory;
 duration_minutes: number;
 price: number;
 payment_type: PaymentType;
 max_capacity: number;
 requires_pet: boolean;
 is_active: boolean;
 buffer_minutes: number;
 min_notice_hours: number;
 allow_recurring: boolean;
 cancellation_policy_hours: number;
 // Flash Sale fields
 is_flash_sale: boolean;
 flash_sale_pawbucks_price?: number | null;
 flash_sale_start_at?: string | null;
 flash_sale_end_at?: string | null;
 created_at: string;
 updated_at: string;
}

// Helper to check if flash sale is currently active
export const isFlashSaleActive = (service: MerchantService): boolean => {
 if (!service.is_flash_sale || !service.flash_sale_pawbucks_price) return false;
 
 const now = new Date();
 const startAt = service.flash_sale_start_at ? new Date(service.flash_sale_start_at) : null;
 const endAt = service.flash_sale_end_at ? new Date(service.flash_sale_end_at) : null;
 
 if (startAt && now < startAt) return false;
 if (endAt && now > endAt) return false;
 
 return true;
};

// Calculate regular PawBucks price (1000 PB per $1)
export const calculateRegularPawbucksPrice = (usdPrice: number): number => {
 return Math.floor(usdPrice * 1000);
};

// Calculate flash sale savings percentage
export const calculateFlashSaleSavings = (service: MerchantService): number => {
 if (!service.flash_sale_pawbucks_price) return 0;
 const regularPrice = calculateRegularPawbucksPrice(service.price);
 if (regularPrice === 0) return 0;
 return Math.round((1 - service.flash_sale_pawbucks_price / regularPrice) * 100);
};

export interface MerchantAvailability {
 id: string;
 merchant_id: string;
 day_of_week: number; // 0 = Sunday, 6 = Saturday
 start_time: string; // HH:MM:SS
 end_time: string;
 slot_duration_minutes: number;
 is_active: boolean;
 created_at: string;
 updated_at: string;
}

export interface AvailabilityOverride {
 id: string;
 merchant_id: string;
 override_date: string; // YYYY-MM-DD
 is_available: boolean;
 start_time?: string;
 end_time?: string;
 reason?: string;
 created_at: string;
 updated_at: string;
}

export interface ServiceBooking {
 id: string;
 service_id: string;
 merchant_id: string;
 user_id: string;
 pet_id?: string;
 booking_date: string;
 start_time: string;
 end_time: string;
 status: BookingStatus;
 payment_status: string;
 total_price: number;
 notes?: string;
 customer_name?: string;
 customer_phone?: string;
 customer_email?: string;
 stripe_payment_intent_id?: string;
 created_at: string;
 updated_at: string;
}

export interface ServiceWithMerchant extends MerchantService {
 merchants?: {
 id: string;
 business_name: string;
 logo_url?: string;
 address?: string;
 };
}

export interface BookingWithDetails extends ServiceBooking {
 merchant_services?: MerchantService;
 pet_profiles?: {
 id: string;
 name: string;
 type: string;
 breed?: string;
 };
}

// Category display names
export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
 daycare:'Daycare',
 boarding:'Boarding',
 grooming:'Grooming',
 walking:'Dog Walking',
 training:'Training',
 veterinary:'Veterinary',
 pet_sitting:'Pet Sitting',
 other:'Other Services',
};

// Day of week labels
export const DAY_LABELS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const DAY_SHORT_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export const schedulingService = {
 // === MERCHANT SERVICES ===
 async getServices(merchantId: string): Promise<MerchantService[]> {
 const { data, error } = await supabase
 .from('merchant_services')
 .select('*')
 .eq('merchant_id', merchantId)
 .order('created_at', { ascending: false });

 if (error) throw error;
 return data || [];
 },

 async getActiveServices(merchantId: string): Promise<MerchantService[]> {
 const { data, error } = await supabase
 .from('merchant_services')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('is_active', true)
 .order('name');

 if (error) throw error;
 return data || [];
 },

 async createService(service: Omit<MerchantService,'id' |'created_at' |'updated_at'>): Promise<MerchantService> {
 const { data, error } = await supabase
 .from('merchant_services')
 .insert(service)
 .select()
 .single();

 if (error) throw error;
 return data;
 },

 async updateService(id: string, updates: Partial<MerchantService>): Promise<MerchantService> {
 const { data, error } = await supabase
 .from('merchant_services')
 .update(updates)
 .eq('id', id)
 .select()
 .single();

 if (error) throw error;
 return data;
 },

 async deleteService(id: string): Promise<void> {
 const { error } = await supabase
 .from('merchant_services')
 .delete()
 .eq('id', id);

 if (error) throw error;
 },

 // === AVAILABILITY ===
 async getAvailability(merchantId: string): Promise<MerchantAvailability[]> {
 const { data, error } = await supabase
 .from('merchant_availability')
 .select('*')
 .eq('merchant_id', merchantId)
 .order('day_of_week');

 if (error) throw error;
 return data || [];
 },

 async setAvailability(availability: Omit<MerchantAvailability,'id' |'created_at' |'updated_at'>): Promise<MerchantAvailability> {
 const { data, error } = await supabase
 .from('merchant_availability')
 .insert(availability)
 .select()
 .single();

 if (error) throw error;
 return data;
 },

 async updateAvailability(id: string, updates: Partial<MerchantAvailability>): Promise<MerchantAvailability> {
 const { data, error } = await supabase
 .from('merchant_availability')
 .update(updates)
 .eq('id', id)
 .select()
 .single();

 if (error) throw error;
 return data;
 },

 async deleteAvailability(id: string): Promise<void> {
 const { error } = await supabase
 .from('merchant_availability')
 .delete()
 .eq('id', id);

 if (error) throw error;
 },

 // === AVAILABILITY OVERRIDES ===
 async getOverrides(merchantId: string, startDate?: string, endDate?: string): Promise<AvailabilityOverride[]> {
 let query = supabase
 .from('merchant_availability_overrides')
 .select('*')
 .eq('merchant_id', merchantId)
 .order('override_date');

 if (startDate) {
 query = query.gte('override_date', startDate);
 }
 if (endDate) {
 query = query.lte('override_date', endDate);
 }

 const { data, error } = await query;
 if (error) throw error;
 return data || [];
 },

 async setOverride(override: Omit<AvailabilityOverride,'id' |'created_at' |'updated_at'>): Promise<AvailabilityOverride> {
 const { data, error } = await supabase
 .from('merchant_availability_overrides')
 .upsert(override, { onConflict:'merchant_id,override_date' })
 .select()
 .single();

 if (error) throw error;
 return data;
 },

 async deleteOverride(id: string): Promise<void> {
 const { error } = await supabase
 .from('merchant_availability_overrides')
 .delete()
 .eq('id', id);

 if (error) throw error;
 },

 // === BOOKINGS ===
 async getMerchantBookings(merchantId: string, status?: BookingStatus): Promise<BookingWithDetails[]> {
 let query = supabase
 .from('service_bookings')
 .select(`
 *,
 merchant_services (*),
 pet_profiles (id, name, type, breed)
 `)
 .eq('merchant_id', merchantId)
 .order('booking_date', { ascending: true })
 .order('start_time', { ascending: true });

 if (status) {
 query = query.eq('status', status);
 }

 const { data, error } = await query;
 if (error) throw error;
 return data || [];
 },

 async getUserBookings(userId: string): Promise<BookingWithDetails[]> {
 const { data, error } = await supabase
 .from('service_bookings')
 .select(`
 *,
 merchant_services (*)
 `)
 .eq('user_id', userId)
 .order('booking_date', { ascending: false });

 if (error) throw error;
 return data || [];
 },

 async createBooking(booking: Omit<ServiceBooking,'id' |'created_at' |'updated_at'>): Promise<ServiceBooking> {
 const { data, error } = await supabase
 .from('service_bookings')
 .insert(booking)
 .select()
 .single();

 if (error) throw error;
 return data;
 },

 async updateBookingStatus(id: string, status: BookingStatus): Promise<ServiceBooking> {
 const { data, error } = await supabase
 .from('service_bookings')
 .update({ status })
 .eq('id', id)
 .select()
 .single();

 if (error) throw error;
 return data;
 },

 async getBookingsForDate(merchantId: string, date: string): Promise<ServiceBooking[]> {
 const { data, error } = await supabase
 .from('service_bookings')
 .select('*')
 .eq('merchant_id', merchantId)
 .eq('booking_date', date)
 .not('status','eq','cancelled');

 if (error) throw error;
 return data || [];
 },

 // === PUBLIC SERVICE DISCOVERY ===
 async searchServices(params?: {
 category?: ServiceCategory;
 location?: string;
 searchTerm?: string;
 }): Promise<ServiceWithMerchant[]> {
 let query = supabase
 .from('merchant_services')
 .select(`
 *,
 merchants!inner (
 id,
 business_name,
 logo_url,
 address
 )
 `)
 .eq('is_active', true);

 if (params?.category) {
 query = query.eq('category', params.category);
 }

 if (params?.searchTerm) {
 query = query.or(`name.ilike.%${params.searchTerm}%,description.ilike.%${params.searchTerm}%`);
 }

 const { data, error } = await query.order('name');
 if (error) throw error;
 return data || [];
 },

 // === SLOT GENERATION ===
 generateTimeSlots(
 availability: MerchantAvailability[],
 overrides: AvailabilityOverride[],
 existingBookings: ServiceBooking[],
 date: Date,
 serviceDuration: number
 ): string[] {
 const dayOfWeek = date.getDay();
 const dateStr = date.toISOString().split('T')[0];

 // Check for override on this date
 const override = overrides.find(o => o.override_date === dateStr);
 
 let startTime: string;
 let endTime: string;

 if (override) {
 if (!override.is_available) {
 return []; // Date is blocked
 }
 startTime = override.start_time!;
 endTime = override.end_time!;
 } else {
 // Use regular weekly availability
 const dayAvailability = availability.find(
 a => a.day_of_week === dayOfWeek && a.is_active
 );
 
 if (!dayAvailability) {
 return []; // Not available this day
 }
 
 startTime = dayAvailability.start_time;
 endTime = dayAvailability.end_time;
 }

 // Generate slots
 const slots: string[] = [];
 const slotDuration = serviceDuration;
 
 const [startHour, startMin] = startTime.split(':').map(Number);
 const [endHour, endMin] = endTime.split(':').map(Number);
 
 let currentMinutes = startHour * 60 + startMin;
 const endMinutes = endHour * 60 + endMin;

 while (currentMinutes + slotDuration <= endMinutes) {
 const hours = Math.floor(currentMinutes / 60);
 const mins = currentMinutes % 60;
 const timeStr = `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:00`;
 
 // Check if slot is already booked
 const isBooked = existingBookings.some(b => {
 const bookingStart = b.start_time;
 const bookingEnd = b.end_time;
 return timeStr >= bookingStart && timeStr < bookingEnd;
 });

 if (!isBooked) {
 slots.push(timeStr.slice(0, 5)); // Return HH:MM format
 }

 currentMinutes += slotDuration;
 }

 return slots;
 },
};
