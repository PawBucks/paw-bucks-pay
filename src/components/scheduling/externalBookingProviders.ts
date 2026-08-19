export type BookingProvider = "calendly" | "cal_com" | "acuity" | "petdesk" | "other";

export interface MerchantBookingIntegration {
  id: string;
  merchant_id: string;
  provider: BookingProvider;
  booking_url: string;
  display_label: string | null;
  is_enabled: boolean;
  replace_in_app_booking: boolean;
}

export const BOOKING_PROVIDERS: Record<
  BookingProvider,
  { label: string; hint: string; example: string }
> = {
  calendly: {
    label: "Calendly",
    hint: "Copy your Calendly event or scheduling page link.",
    example: "https://calendly.com/your-business/consult",
  },
  cal_com: {
    label: "Cal.com",
    hint: "Copy your Cal.com booking page link.",
    example: "https://cal.com/your-business/grooming",
  },
  acuity: {
    label: "Acuity Scheduling",
    hint: "Copy your Acuity client scheduling page link.",
    example: "https://your-business.as.me/schedule",
  },
  petdesk: {
    label: "PetDesk",
    hint: "Copy your PetDesk online booking link.",
    example: "https://petdesk.com/your-clinic/request",
  },
  other: {
    label: "Other scheduling tool",
    hint: "Paste any secure (https) booking page link.",
    example: "https://booking.your-business.com",
  },
};

export const providerLabel = (provider: BookingProvider) =>
  BOOKING_PROVIDERS[provider]?.label ?? "Scheduling page";