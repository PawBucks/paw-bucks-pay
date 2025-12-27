import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  type MerchantService, 
  type ServiceCategory,
  type PaymentType,
  CATEGORY_LABELS 
} from "@/services/api/scheduling.service";

const serviceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['daycare', 'boarding', 'grooming', 'walking', 'training', 'veterinary', 'pet_sitting', 'other']),
  duration_minutes: z.coerce.number().min(30, "Minimum 30 minutes").max(20160, "Maximum 14 nights"),
  price: z.coerce.number().min(0, "Price must be positive"),
  payment_type: z.enum(['pay_at_booking', 'pay_at_service', 'both']),
  max_capacity: z.coerce.number().min(1).max(100),
  requires_pet: z.boolean(),
  is_active: z.boolean(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: MerchantService | null;
  onSubmit: (data: ServiceFormData) => Promise<void>;
}

const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  pay_at_booking: 'Pay at booking',
  pay_at_service: 'Pay at service',
  both: 'Either option',
};

// Standard duration options (in minutes): 30min, 1h, 2h, 3h, 4h
const STANDARD_DURATION_PRESETS = [30, 60, 120, 180, 240];

// Daycare duration options: 1h, Half Day (6h), Full Day (12h)
const DAYCARE_DURATION_PRESETS = [
  { value: 60, label: '1 Hour' },
  { value: 360, label: 'Half Day (up to 6 hours)' },
  { value: 720, label: 'Full Day (up to 12 hours)' },
];

// Boarding duration options (in nights - stored as minutes: 1440 min = 1 day/night)
const BOARDING_DURATION_PRESETS = [
  { value: 1440, label: '1 Night' },
  { value: 2880, label: '2 Nights' },
  { value: 4320, label: '3 Nights' },
  { value: 5760, label: '4 Nights' },
  { value: 7200, label: '5 Nights' },
  { value: 10080, label: '7 Nights (1 Week)' },
  { value: 20160, label: '14 Nights (2 Weeks)' },
];

export function ServiceDialog({ open, onOpenChange, service, onSubmit }: ServiceDialogProps) {
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'other',
      duration_minutes: 60,
      price: 0,
      payment_type: 'both',
      max_capacity: 1,
      requires_pet: true,
      is_active: true,
    },
  });

  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        description: service.description || '',
        category: service.category,
        duration_minutes: service.duration_minutes,
        price: service.price,
        payment_type: service.payment_type,
        max_capacity: service.max_capacity,
        requires_pet: service.requires_pet,
        is_active: service.is_active,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        category: 'other',
        duration_minutes: 60,
        price: 0,
        payment_type: 'both',
        max_capacity: 1,
        requires_pet: true,
        is_active: true,
      });
    }
  }, [service, form]);

  const handleSubmit = async (data: ServiceFormData) => {
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? 'Edit Service' : 'Create Service'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Full Day Daycare" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe what's included in this service..."
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.entries(CATEGORY_LABELS) as [ServiceCategory, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => {
                  const category = form.watch('category');
                  const isBoarding = category === 'boarding';
                  const isDaycare = category === 'daycare';
                  
                  const formatStandardDuration = (mins: number) => {
                    if (mins >= 60) {
                      const hours = Math.floor(mins / 60);
                      const remainingMins = mins % 60;
                      return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
                    }
                    return `${mins}m`;
                  };

                  return (
                    <FormItem>
                      <FormLabel>
                        {isBoarding ? 'Duration (Nights)' : isDaycare ? 'Duration' : 'Duration'}
                      </FormLabel>
                      <Select 
                        onValueChange={(v) => field.onChange(parseInt(v))} 
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isBoarding ? (
                            BOARDING_DURATION_PRESETS.map((preset) => (
                              <SelectItem key={preset.value} value={preset.value.toString()}>
                                {preset.label}
                              </SelectItem>
                            ))
                          ) : isDaycare ? (
                            DAYCARE_DURATION_PRESETS.map((preset) => (
                              <SelectItem key={preset.value} value={preset.value.toString()}>
                                {preset.label}
                              </SelectItem>
                            ))
                          ) : (
                            STANDARD_DURATION_PRESETS.map((mins) => (
                              <SelectItem key={mins} value={mins.toString()}>
                                {formatStandardDuration(mins)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        placeholder="0.00"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="payment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Option</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.entries(PAYMENT_TYPE_LABELS) as [PaymentType, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose when customers should pay for this service
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Capacity per Slot</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      max="100"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    How many bookings can be accepted for the same time slot
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requires_pet"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Requires Pet Selection</FormLabel>
                    <FormDescription>
                      Customer must select a pet when booking
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormDescription>
                      Service is visible and bookable
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : service ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
