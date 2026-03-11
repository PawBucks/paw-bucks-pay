
-- Merchant Messages table
CREATE TABLE public.merchant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'merchant')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Merchant Message Attachments table
CREATE TABLE public.merchant_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.merchant_messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image',
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_merchant_messages_merchant_id ON public.merchant_messages(merchant_id);
CREATE INDEX idx_merchant_messages_user_id ON public.merchant_messages(user_id);
CREATE INDEX idx_merchant_messages_created_at ON public.merchant_messages(created_at DESC);
CREATE INDEX idx_merchant_message_attachments_message_id ON public.merchant_message_attachments(message_id);

-- Enable RLS
ALTER TABLE public.merchant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_messages
-- Customers can read/insert their own messages
CREATE POLICY "Users can read own messages" ON public.merchant_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Merchants can read messages for their merchant account
CREATE POLICY "Merchants can read their messages" ON public.merchant_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid()
  ));

-- Customers can send messages (sender_type = customer)
CREATE POLICY "Users can send messages" ON public.merchant_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND sender_type = 'customer');

-- Merchants can send messages (sender_type = merchant)
CREATE POLICY "Merchants can send messages" ON public.merchant_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'merchant' AND
    EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid())
  );

-- Users can mark messages as read (their own incoming messages)
CREATE POLICY "Users can update read status" ON public.merchant_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND sender_type = 'merchant')
  WITH CHECK (user_id = auth.uid() AND sender_type = 'merchant');

-- Merchants can mark messages as read
CREATE POLICY "Merchants can update read status" ON public.merchant_messages
  FOR UPDATE TO authenticated
  USING (
    sender_type = 'customer' AND
    EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid())
  )
  WITH CHECK (
    sender_type = 'customer' AND
    EXISTS (SELECT 1 FROM merchants WHERE id = merchant_id AND user_id = auth.uid())
  );

-- RLS for attachments - follow message access
CREATE POLICY "Users can view attachments for their messages" ON public.merchant_message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM merchant_messages mm
    WHERE mm.id = message_id AND (
      mm.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM merchants WHERE id = mm.merchant_id AND user_id = auth.uid())
    )
  ));

CREATE POLICY "Users can insert attachments for their messages" ON public.merchant_message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM merchant_messages mm
    WHERE mm.id = message_id AND (
      mm.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM merchants WHERE id = mm.merchant_id AND user_id = auth.uid())
    )
  ));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_messages;

-- Storage bucket for merchant message attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('merchant-messages', 'merchant-messages', true, 10485760);

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload merchant message files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'merchant-messages');

CREATE POLICY "Anyone can view merchant message files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'merchant-messages');
