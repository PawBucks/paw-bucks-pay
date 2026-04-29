import { supabase } from"@/integrations/supabase/client";
import { PostgrestError } from"@supabase/supabase-js";

export type ServiceResult<T> = {
 data: T | null;
 error: PostgrestError | Error | null;
};

export type ServiceListResult<T> = {
 data: T[];
 error: PostgrestError | Error | null;
};

export const handleError = (error: unknown): Error => {
 if (error instanceof Error) return error;
 return new Error(String(error));
};

export { supabase };
