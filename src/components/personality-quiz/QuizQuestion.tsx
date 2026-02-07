import { motion, AnimatePresence } from "framer-motion";
import { QuizQuestion as QuizQuestionType, QuizOption, PersonalityType } from "./types";

interface QuizQuestionProps {
  question: QuizQuestionType;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: PersonalityType | undefined;
  onSelect: (personality: PersonalityType) => void;
}

export const QuizQuestion = ({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelect,
}: QuizQuestionProps) => {
  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-6"
    >
      {/* Progress indicator */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-1.5">
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <motion.div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i < questionNumber
                  ? "w-8 bg-primary"
                  : i === questionNumber
                  ? "w-8 bg-primary/50"
                  : "w-2 bg-muted"
              }`}
              initial={false}
              animate={{
                width: i <= questionNumber ? 32 : 8,
              }}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {questionNumber + 1}/{totalQuestions}
        </span>
      </div>

      {/* Context bubble */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center"
      >
        <span className="inline-block bg-primary/10 px-4 py-2 rounded-full text-sm font-medium">
          {question.context}
        </span>
      </motion.div>

      {/* Question */}
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-2xl md:text-3xl font-bold text-center"
      >
        {question.question}
      </motion.h2>

      {/* Options */}
      <div className="space-y-3 mt-8">
        <AnimatePresence mode="wait">
          {question.options.map((option, index) => (
            <OptionCard
              key={option.id}
              option={option}
              index={index}
              isSelected={selectedAnswer === option.personality}
              onSelect={() => onSelect(option.personality)}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

interface OptionCardProps {
  option: QuizOption;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const OptionCard = ({ option, index, isSelected, onSelect }: OptionCardProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1 }}
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group ${
        isSelected
          ? "border-primary bg-primary/10 shadow-md"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-4">
        <motion.span
          className="text-3xl"
          animate={{ rotate: isSelected ? [0, -10, 10, 0] : 0 }}
          transition={{ duration: 0.3 }}
        >
          {option.emoji}
        </motion.span>
        <span className={`text-base md:text-lg ${isSelected ? "font-medium" : ""}`}>
          {option.text}
        </span>
        {isSelected && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-auto text-primary"
          >
            ✓
          </motion.span>
        )}
      </div>
    </motion.button>
  );
};
