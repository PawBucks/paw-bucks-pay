import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, XCircle, MinusCircle, ClipboardCheck, 
  ChevronDown, ChevronUp, Loader2, ShieldCheck, AlertTriangle,
  StickyNote
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AnswerValue = 'yes' | 'no' | 'na';

type VerificationQuestion = {
  id: string;
  entity_type: string;
  question: string;
  description: string | null;
  display_order: number;
};

type VerificationAnswer = {
  id: string;
  question_id: string;
  answer: AnswerValue;
  notes: string | null;
  answered_by: string;
};

type Props = {
  entityType: 'merchant' | 'vet';
  entityId: string;
  onChecklistComplete?: (allAnswered: boolean, hasFailures: boolean) => void;
};

export function VerificationChecklist({ entityType, entityId, onChecklistComplete }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['verification-questions', entityType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_questions')
        .select('id, entity_type, question, description, display_order')
        .eq('entity_type', entityType)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return (data || []) as VerificationQuestion[];
    },
  });

  const { data: answers = [], isLoading: answersLoading } = useQuery({
    queryKey: ['verification-answers', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_answers')
        .select('id, question_id, answer, notes, answered_by')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId);
      if (error) throw error;
      return (data || []) as VerificationAnswer[];
    },
  });

  const answerMap = useMemo(() => {
    const map: Record<string, VerificationAnswer> = {};
    answers.forEach(a => { map[a.question_id] = a; });
    return map;
  }, [answers]);

  // Compute completion stats
  const stats = useMemo(() => {
    const total = questions.length;
    const answered = questions.filter(q => answerMap[q.id]).length;
    const yesCount = questions.filter(q => answerMap[q.id]?.answer === 'yes').length;
    const noCount = questions.filter(q => answerMap[q.id]?.answer === 'no').length;
    const naCount = questions.filter(q => answerMap[q.id]?.answer === 'na').length;
    const allAnswered = total > 0 && answered === total;
    const hasFailures = noCount > 0;

    onChecklistComplete?.(allAnswered, hasFailures);

    return { total, answered, yesCount, noCount, naCount, allAnswered, hasFailures };
  }, [questions, answerMap, onChecklistComplete]);

  const upsertAnswer = useMutation({
    mutationFn: async ({ questionId, answer, notes }: { questionId: string; answer: AnswerValue; notes?: string }) => {
      if (!user) throw new Error('Not authenticated');

      const existing = answerMap[questionId];
      if (existing) {
        const { error } = await supabase
          .from('verification_answers')
          .update({ answer, notes: notes ?? existing.notes, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('verification_answers')
          .insert({
            entity_type: entityType,
            entity_id: entityId,
            question_id: questionId,
            answer,
            notes: notes || null,
            answered_by: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-answers', entityType, entityId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save answer');
    },
  });

  const saveNote = useMutation({
    mutationFn: async ({ questionId, notes }: { questionId: string; notes: string }) => {
      const existing = answerMap[questionId];
      if (!existing) {
        toast.error('Please select an answer first');
        throw new Error('No answer yet');
      }
      const { error } = await supabase
        .from('verification_answers')
        .update({ notes, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['verification-answers', entityType, entityId] });
      toast.success('Note saved');
      setExpandedNotes(prev => ({ ...prev, [vars.questionId]: false }));
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save note');
    },
  });

  const toggleNotes = (questionId: string) => {
    const isExpanding = !expandedNotes[questionId];
    setExpandedNotes(prev => ({ ...prev, [questionId]: isExpanding }));
    if (isExpanding && !noteValues[questionId]) {
      setNoteValues(prev => ({ ...prev, [questionId]: answerMap[questionId]?.notes || '' }));
    }
  };

  if (questionsLoading || answersLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const answerButton = (questionId: string, value: AnswerValue, current?: AnswerValue) => {
    const isActive = current === value;
    const configs: Record<AnswerValue, { icon: typeof CheckCircle2; label: string; activeClass: string }> = {
      yes: { icon: CheckCircle2, label: 'Yes', activeClass: 'bg-green-100 border-green-500 text-green-700 dark:bg-green-950 dark:text-green-400' },
      no: { icon: XCircle, label: 'No', activeClass: 'bg-red-100 border-red-500 text-red-700 dark:bg-red-950 dark:text-red-400' },
      na: { icon: MinusCircle, label: 'N/A', activeClass: 'bg-muted border-muted-foreground/30 text-muted-foreground' },
    };
    const cfg = configs[value];
    const Icon = cfg.icon;

    return (
      <button
        key={value}
        onClick={() => upsertAnswer.mutate({ questionId, answer: value })}
        disabled={upsertAnswer.isPending}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-all',
          isActive ? cfg.activeClass : 'border-border hover:bg-accent text-muted-foreground'
        )}
      >
        <Icon className="w-3.5 h-3.5" />
        {cfg.label}
      </button>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Verification Checklist</CardTitle>
          </div>
          <Badge 
            variant={stats.allAnswered ? (stats.hasFailures ? 'destructive' : 'default') : 'secondary'}
            className="text-xs"
          >
            {stats.answered}/{stats.total} Complete
          </Badge>
        </div>
        <CardDescription className="text-xs">
          All questions must be answered before approving. Verify the applicant is a licensed, bonded, and insured professional.
        </CardDescription>
      </CardHeader>

      {/* Progress summary */}
      <div className="px-6 pb-3">
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> {stats.yesCount} Verified
          </span>
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <XCircle className="w-3.5 h-3.5" /> {stats.noCount} Failed
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <MinusCircle className="w-3.5 h-3.5" /> {stats.naCount} N/A
          </span>
        </div>
        {stats.allAnswered && !stats.hasFailures && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
            <ShieldCheck className="w-4 h-4" /> All checks passed — eligible for approval
          </div>
        )}
        {stats.hasFailures && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
            <AlertTriangle className="w-4 h-4" /> {stats.noCount} check(s) failed — review before approving
          </div>
        )}
      </div>

      <Separator />

      <CardContent className="p-0">
        <div className="divide-y divide-border">
            {questions.map((q, idx) => {
              const existing = answerMap[q.id];
              return (
                <div key={q.id} className="px-6 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted-foreground shrink-0">
                          {idx + 1}.
                        </span>
                        <p className="text-sm font-medium leading-snug">{q.question}</p>
                      </div>
                      {q.description && (
                        <p className="text-xs text-muted-foreground mt-1 ml-5">{q.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-5">
                    {(['yes', 'no', 'na'] as AnswerValue[]).map(v => answerButton(q.id, v, existing?.answer as AnswerValue | undefined))}
                    <button
                      onClick={() => toggleNotes(q.id)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-accent transition-colors',
                        existing?.notes && 'text-primary'
                      )}
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      {expandedNotes[q.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {expandedNotes[q.id] && (
                    <div className="ml-5 space-y-2">
                      <Textarea
                        placeholder="Add notes, evidence, or details..."
                        value={noteValues[q.id] || ''}
                        onChange={(e) => setNoteValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                        rows={2}
                        className="text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => saveNote.mutate({ questionId: q.id, notes: noteValues[q.id] || '' })}
                        disabled={saveNote.isPending}
                      >
                        {saveNote.isPending ? 'Saving...' : 'Save Note'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}
