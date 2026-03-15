import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Send, Bug, CreditCard, Lightbulb, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from './LoadingSpinner';

const FEEDBACK_CATEGORIES = [
  { value: 'general', label: 'General Feedback', icon: HelpCircle },
  { value: 'technical_issue', label: 'Report a Bug', icon: Bug },
  { value: 'billing_payments', label: 'Billing Question', icon: CreditCard },
  { value: 'feature_request', label: 'Feature Suggestion', icon: Lightbulb },
];

/**
 * Floating feedback button for users to submit feedback
 */
export const FeedbackButton = () => {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [userName, setUserName] = useState<string | undefined>();
  const [userId, setUserId] = useState<string | undefined>();

  // Fetch user data when dialog opens
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        const { data: merchant } = await supabase
          .from('merchants')
          .select('business_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (merchant?.business_name) {
          setUserName(`${profile?.full_name || 'User'} (${merchant.business_name})`);
        } else if (profile?.full_name) {
          setUserName(profile.full_name);
        }
      }
    };
    
    if (open) {
      fetchUser();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      toast.error('Please enter your feedback');
      return;
    }

    setLoading(true);
    
    try {
      // Save as a support ticket if user is authenticated
      if (userId) {
        const { error: ticketError } = await supabase
          .from('support_tickets')
          .insert({
            user_id: userId,
            submitter_type: 'pet_owner',
            category: category as any,
            priority: 'medium',
            subject: subject.trim() || `${FEEDBACK_CATEGORIES.find(c => c.value === category)?.label || 'Feedback'}`,
            description: feedback.trim(),
            ticket_number: '',
          });

        if (ticketError) {
          console.error('Error saving ticket:', ticketError);
          // Fall back to email-only
        }
      }

      // Also send email notification
      const { error } = await supabase.functions.invoke('send-feedback', {
        body: { feedback, userEmail, userName, userId }
      });

      if (error) throw error;
      
      toast.success('Thank you for your feedback! We\'ll review it shortly.');
      setFeedback('');
      setSubject('');
      setCategory('general');
      setOpen(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-[5.5rem] right-4 z-40 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 md:bottom-[4.5rem]"
          aria-label="Send feedback"
        >
          <MessageSquare className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Help us improve PawBucks! Share your thoughts, report issues, or suggest features.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className="w-4 h-4" />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (optional)</Label>
            <input
              id="subject"
              type="text"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Brief summary..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              disabled={loading}
            />
          </div>

          {/* Feedback */}
          <div className="space-y-2">
            <Label htmlFor="feedback">Your Feedback *</Label>
            <Textarea
              id="feedback"
              placeholder="Tell us what you think..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={5}
              disabled={loading}
              className="resize-none"
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">{feedback.length}/5000</p>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !feedback.trim()} className="flex-1">
              {loading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
