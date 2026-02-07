import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { QuizIntro } from "./QuizIntro";
import { QuizQuestion } from "./QuizQuestion";
import { QuizResult } from "./QuizResult";
import { getQuestionsForPetType } from "./quizQuestions";
import { PersonalityType, PersonalityResult, QuizState } from "./types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";

interface PetPersonalityQuizProps {
  petId?: string;
  petName?: string;
  onComplete?: () => void;
}

export const PetPersonalityQuiz = ({ 
  petId: propPetId, 
  petName: propPetName,
  onComplete 
}: PetPersonalityQuizProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [petId, setPetId] = useState<string>(propPetId || "");
  const [petName, setPetName] = useState<string>(propPetName || "Your pet");
  const [petType, setPetType] = useState<string>("dog");

  // Get questions based on pet type
  const quizQuestions = useMemo(() => getQuestionsForPetType(petType), [petType]);
  
  const [quizState, setQuizState] = useState<QuizState>({
    currentQuestion: -1, // -1 = intro screen
    answers: {},
    isComplete: false,
    result: null,
  });

  // Load pet info if not provided
  useEffect(() => {
    const loadPetInfo = async () => {
      if (!user) return;
      
      // Check URL params first
      const urlPetId = searchParams.get("petId");
      
      if (propPetId) {
        setPetId(propPetId);
      } else if (urlPetId) {
        setPetId(urlPetId);
      }
      
      // Fetch pet name and type if we have an ID
      const targetPetId = propPetId || urlPetId;
      if (targetPetId) {
        const { data: pet } = await supabase
          .from("pet_profiles")
          .select("name, type")
          .eq("id", targetPetId)
          .single();
        
        if (pet) {
          setPetName(pet.name);
          setPetType(pet.type || "dog");
        }
      } else {
        // Get the most recently created pet
        const { data: pets } = await supabase
          .from("pet_profiles")
          .select("id, name, type")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);
        
        if (pets && pets.length > 0) {
          setPetId(pets[0].id);
          setPetName(pets[0].name);
          setPetType(pets[0].type || "dog");
        }
      }
      
      setIsLoading(false);
    };

    loadPetInfo();
  }, [user, propPetId, propPetName, searchParams]);

  const startQuiz = () => {
    setQuizState((prev) => ({ ...prev, currentQuestion: 0 }));
  };

  const handleAnswer = (personality: PersonalityType) => {
    const newAnswers = {
      ...quizState.answers,
      [quizState.currentQuestion]: personality,
    };

    setQuizState((prev) => ({
      ...prev,
      answers: newAnswers,
    }));

    // Auto-advance after a brief delay for better UX
    setTimeout(() => {
      if (quizState.currentQuestion < quizQuestions.length - 1) {
        setQuizState((prev) => ({
          ...prev,
          currentQuestion: prev.currentQuestion + 1,
        }));
      } else {
        // Calculate result
        calculateResult(newAnswers);
      }
    }, 400);
  };

  const calculateResult = async (answers: Record<number, PersonalityType>) => {
    // Count personality types
    const counts: Record<PersonalityType, number> = {
      couch_potato: 0,
      guard_dog: 0,
      chaotic_neutral: 0,
      social_butterfly: 0,
      adventurer: 0,
    };

    Object.values(answers).forEach((personality) => {
      counts[personality]++;
    });

    // Find the dominant personality
    let dominantType: PersonalityType = "social_butterfly";
    let maxCount = 0;
    
    (Object.entries(counts) as [PersonalityType, number][]).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type;
      }
    });

    // Fetch full personality data
    const { data: personalityData, error } = await supabase
      .from("pet_personality_types")
      .select("*")
      .eq("type_key", dominantType)
      .single();

    if (error || !personalityData) {
      toast.error("Failed to load personality result");
      return;
    }

    setQuizState((prev) => ({
      ...prev,
      isComplete: true,
      result: personalityData as PersonalityResult,
    }));

    // Save result to database
    await saveResult(dominantType, answers, personalityData);
  };

  const saveResult = async (
    personalityType: string,
    answers: Record<number, PersonalityType>,
    result: PersonalityResult
  ) => {
    if (!user || !petId) return;

    setIsSaving(true);
    try {
      // Update pet profile
      const { error: profileError } = await supabase
        .from("pet_profiles")
        .update({
          personality_type: personalityType,
          personality_quiz_completed: true,
          personality_quiz_answers: answers,
          personality_completed_at: new Date().toISOString(),
        })
        .eq("id", petId);

      if (profileError) throw profileError;

      // Create badge
      const { error: badgeError } = await supabase
        .from("user_personality_badges")
        .upsert({
          user_id: user.id,
          pet_id: petId,
          personality_type: personalityType,
          badge_earned_at: new Date().toISOString(),
        }, {
          onConflict: 'pet_id'
        });

      if (badgeError) throw badgeError;

      toast.success(`${petName}'s personality badge earned!`);
    } catch (error: any) {
      console.error("Error saving quiz result:", error);
      toast.error("Failed to save result, but don't worry - you can retake the quiz later!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinue = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate("/dashboard");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6 md:p-8">
        <AnimatePresence mode="wait">
          {quizState.currentQuestion === -1 && (
            <QuizIntro petName={petName} onStart={startQuiz} />
          )}
          
          {quizState.currentQuestion >= 0 && !quizState.isComplete && (
            <QuizQuestion
              question={quizQuestions[quizState.currentQuestion]}
              questionNumber={quizState.currentQuestion}
              totalQuestions={quizQuestions.length}
              selectedAnswer={quizState.answers[quizState.currentQuestion]}
              onSelect={handleAnswer}
            />
          )}
          
          {quizState.isComplete && quizState.result && (
            <QuizResult
              petName={petName}
              petType={petType}
              result={quizState.result}
              onContinue={handleContinue}
            />
          )}
        </AnimatePresence>
        
        {isSaving && (
          <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
            <div className="bg-card p-4 rounded-lg shadow-lg flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Saving your results...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
