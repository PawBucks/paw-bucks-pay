import { motion } from"framer-motion";
import { Button } from"@/components/ui/button";
import { GradientCard } from"@/components/ui/gradient-card";
import { Sparkles, PawPrint, ArrowRight } from"lucide-react";
import { useNavigate } from"react-router-dom";

interface PersonalityQuizCTAProps {
 petId: string;
 petName: string;
}

export const PersonalityQuizCTA = ({ petId, petName }: PersonalityQuizCTAProps) => {
 const navigate = useNavigate();

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.2 }}
 >
 <GradientCard className="relative overflow-hidden">
 {/* Background decoration */}
 <div className="absolute -right-4 -top-4 opacity-10">
 <PawPrint className="w-32 h-32 text-primary rotate-12" />
 </div>
 
 <div className="relative z-10">
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Sparkles className="w-6 h-6 text-primary" />
 </div>
 
 <div className="flex-1">
 <h3 className="text-lg font-bold mb-1">
 🐾 Who's really in charge?
 </h3>
 <p className="text-sm text-muted-foreground mb-4">
 Discover <span className="font-medium text-foreground">{petName}'s</span> personality type! 
 Answer 3 quick questions → get exclusive perks and a badge!
 </p>
 
 <div className="flex flex-wrap gap-2 mb-4">
 {[
 { emoji:"🎭", text:"Personality type" },
 { emoji:"💝", text:"Personalized tips" },
 { emoji:"🏆", text:"Exclusive badge" },
 ].map((item, i) => (
 <span
 key={i}
 className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded-full text-xs"
 >
 {item.emoji} {item.text}
 </span>
 ))}
 </div>
 
 <Button
 onClick={() => navigate(`/pet-personality-quiz?petId=${petId}`)}
 className="group"
 >
 <Sparkles className="w-4 h-4 mr-2" />
 Start Quiz
 <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
 </Button>
 
 <p className="text-xs text-muted-foreground mt-2">
 ⏱️ Takes less than 30 seconds!
 </p>
 </div>
 </div>
 </div>
 </GradientCard>
 </motion.div>
 );
};
