import { motion } from"framer-motion";
import { Button } from"@/components/ui/button";
import { Badge } from"@/components/ui/badge";
import { PersonalityResult } from"./types";
import { ArrowRight } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";
import confetti from"canvas-confetti";
import { useEffect, useMemo } from"react";
import { transformPersonalityData } from"./personalityNameUtils";

interface QuizResultProps {
 petName: string;
 petType: string;
 result: PersonalityResult;
 onContinue: () => void;
}

export const QuizResult = ({ petName, petType, result, onContinue }: QuizResultProps) => {
 // Transform personality data to match pet type (e.g.,"Guard Dog" →"Guard Cat")
 const transformedResult = useMemo(
 () => transformPersonalityData(result, petType),
 [result, petType]
 );
 // Trigger confetti on mount
 useEffect(() => {
 const duration = 3000;
 const end = Date.now() + duration;

 const colors = [result.color_primary, result.color_secondary,'#FFD700'];

 (function frame() {
 confetti({
 particleCount: 3,
 angle: 60,
 spread: 55,
 origin: { x: 0 },
 colors: colors,
 });
 confetti({
 particleCount: 3,
 angle: 120,
 spread: 55,
 origin: { x: 1 },
 colors: colors,
 });

 if (Date.now() < end) {
 requestAnimationFrame(frame);
 }
 })();
 }, [result.color_primary, result.color_secondary]);

 return (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className="space-y-8 py-6"
 >
 {/* Celebration header */}
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ type:"spring", stiffness: 200, delay: 0.2 }}
 className="text-center"
 >
 <span className="text-6xl mb-4 block">{transformedResult.emoji}</span>
 <h1 className="text-3xl md:text-4xl font-bold mb-2">
 {petName} is...
 </h1>
 <motion.h2
 initial={{ y: 20, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 transition={{ delay: 0.5 }}
 className="text-4xl md:text-5xl font-bold"
 style={{ color: transformedResult.color_primary }}
 >
 {transformedResult.name}!
 </motion.h2>
 </motion.div>

 {/* Tagline */}
 <motion.p
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.7 }}
 className="text-xl text-center text-muted-foreground italic"
 >
"{transformedResult.tagline}"
 </motion.p>

 {/* Description card */}
 <motion.div
 initial={{ y: 30, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 transition={{ delay: 0.9 }}
 className="bg-gradient-to-br rounded-md p-6 border-2"
 style={{
 borderColor: transformedResult.color_primary,
 background: `linear-gradient(135deg, ${transformedResult.color_primary}10, ${transformedResult.color_secondary}10)`,
 }}
 >
 <p className="text-center text-lg">{transformedResult.description}</p>
 </motion.div>

 {/* Traits */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 1.1 }}
 className="text-center"
 >
 <h3 className="font-semibold mb-3 flex items-center justify-center gap-2">
 <span className="w-4 h-4 text-warning" aria-hidden="true">⭐</span>
 Key Traits
 </h3>
 <div className="flex flex-wrap justify-center gap-2">
 {transformedResult.traits.map((trait, i) => (
 <motion.div
 key={trait}
 initial={{ scale: 0 }}
 animate={{ scale: 1 }}
 transition={{ delay: 1.2 + i * 0.1 }}
 >
 <Badge
 variant="secondary"
 className="text-sm px-3 py-1"
 style={{ backgroundColor: `${transformedResult.color_primary}20` }}
 >
 {trait}
 </Badge>
 </motion.div>
 ))}
 </div>
 </motion.div>

 {/* Tips */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 1.5 }}
 className="bg-muted rounded-md p-5"
 >
 <h3 className="font-semibold mb-3 flex items-center gap-2">
 <span className="w-4 h-4 text-warning" aria-hidden="true">💡</span>
 Tips for {transformedResult.name} Parents
 </h3>
 <ul className="space-y-2">
 {transformedResult.tips.map((tip, i) => (
 <motion.li
 key={i}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 1.6 + i * 0.1 }}
 className="flex items-start gap-2 text-sm"
 >
 <span className="text-primary">•</span>
 {tip}
 </motion.li>
 ))}
 </ul>
 </motion.div>

 {/* Badge earned */}
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ delay: 1.8, type:"spring" }}
 className="text-center py-4"
 >
 <div
 className="inline-block px-6 py-3 rounded-full font-bold text-white shadow-lg"
 style={{
 background: `linear-gradient(135deg, ${transformedResult.color_primary}, ${transformedResult.color_secondary})`,
 }}
 >
 <Sparkles className="w-4 h-4 inline mr-2" />
 {transformedResult.badge_text}
 </div>
 <p className="text-sm text-muted-foreground mt-2">
 🎉 Badge added to your profile!
 </p>
 </motion.div>

 {/* Continue button */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 2 }}
 className="text-center pt-4"
 >
 <Button
 size="lg"
 onClick={onContinue}
 className="text-lg px-8 py-6 rounded-md"
 >
 Continue to Dashboard
 <ArrowRight className="w-5 h-5 ml-2" />
 </Button>
 </motion.div>
 </motion.div>
 );
};
