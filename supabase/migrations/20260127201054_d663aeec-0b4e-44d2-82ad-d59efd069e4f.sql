-- Allow users to view invoices where they are the client (matched by email)
CREATE POLICY "Clients can view their own invoices"
ON public.invoices
FOR SELECT
USING (client_email = public.get_current_user_email());