import { motion } from"framer-motion";
import { Button } from"@/components/ui/button";
import { PawPrint } from "lucide-react";
import { Sparkles } from "@/components/ui/sparkles-emoji";

interface QuizIntroProps {
 petName: string;
 onStart: () => void;
}

export const QuizIntro = ({ petName, onStart }: QuizIntroProps) => {
 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="text-center space-y-6 py-8"
 >
 {/* Animated paw prints */}
 <div className="flex justify-center gap-4 mb-6">
 {[0, 1, 2].map((i) => (
 <motion.div
 key={i}
 initial={{ opacity: 0, scale: 0, rotate: -20 }}
 animate={{ opacity: 1, scale: 1, rotate: 0 }}
 transition={{ delay: i * 0.2, type:"spring", stiffness: 200 }}
 >
 <PawPrint className="w-8 h-8 text-primary" />
 </motion.div>
 ))}
 </div>

 {/* Main heading */}
 <motion.div
 initial={{ opacity: 0, scale: 0.9 }}
 animate={{ opacity: 1, scale: 1 }}
 transition={{ delay: 0.5 }}
 >
 <h1 className="text-4xl md:text-5xl font-bold mb-2">
 🐾 Who's <span className="text-primary">really</span> in charge?
 </h1>
 </motion.div>

 {/* Subheading */}
 <motion.p
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.7 }}
 className="text-xl text-muted-foreground max-w-md mx-auto"
 >
 Answer 3 quick questions about{""}
 <span className="font-semibold text-foreground">{petName}</span> → get
 their personality type, exclusive perks, and a special badge!
 </motion.p>

 {/* Benefits */}
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 transition={{ delay: 0.9 }}
 className="flex flex-wrap justify-center gap-3 py-4"
 >
 {[
 { emoji:"🎭", text:"Unique personality type" },
 { emoji:"💝", text:"Personalized tips" },
 { emoji:"🏆", text:"Exclusive badge" },
 ].map((benefit, i) => (
 <motion.div
 key={i}
 initial={{ opacity: 0, x: -10 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ delay: 1 + i * 0.1 }}
 className="bg-primary/10 px-4 py-2 rounded-full text-sm font-medium"
 >
 {benefit.emoji} {benefit.text}
 </motion.div>
 ))}
 </motion.div>

 {/* CTA Button */}
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 1.3 }}
 >
 <Button
 size="lg"
 onClick={onStart}
 className="text-lg px-8 py-6 rounded-md shadow-lg hover:shadow-xl transition-all"
 >
 <Sparkles className="w-5 h-5 mr-2" />
 Start Quiz
 </Button>
 <p className="text-xs text-muted-foreground mt-3">
 ⏱️ Takes less than 30 seconds!
 </p>
 </motion.div>
 </motion.div>
 );
};
