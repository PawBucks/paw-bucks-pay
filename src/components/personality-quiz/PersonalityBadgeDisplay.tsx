import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PersonalityBadgeDisplayProps {
  petId: string;
  petName: string;
  personalityType?: string | null;
  personalityData?: {
    name: string;
    emoji: string;
    color_primary: string;
    badge_text: string;
  } | null;
  compact?: boolean;
}

export const PersonalityBadgeDisplay = ({
  petId,
  petName,
  personalityType,
  personalityData,
  compact = false,
}: PersonalityBadgeDisplayProps) => {
  const navigate = useNavigate();

  // No personality yet - show CTA to take quiz
  if (!personalityType || !personalityData) {
    if (compact) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/pet-personality-quiz?petId=${petId}`)}
          className="text-xs h-7"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Take Quiz
        </Button>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3 border border-primary/20"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Discover {petName}'s personality!</p>
            <p className="text-xs text-muted-foreground">Take a 30-second quiz</p>
          </div>
          <Button
            size="sm"
            onClick={() => navigate(`/pet-personality-quiz?petId=${petId}`)}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Start Quiz
          </Button>
        </div>
      </motion.div>
    );
  }

  // Has personality - show badge
  if (compact) {
    return (
      <Badge
        variant="secondary"
        className="text-xs font-medium"
        style={{
          backgroundColor: `${personalityData.color_primary}20`,
          color: personalityData.color_primary,
        }}
      >
        {personalityData.emoji} {personalityData.name}
      </Badge>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg p-3 border"
      style={{
        background: `linear-gradient(135deg, ${personalityData.color_primary}15, ${personalityData.color_primary}05)`,
        borderColor: `${personalityData.color_primary}30`,
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{personalityData.emoji}</span>
        <div>
          <p className="font-medium text-sm">{personalityData.name}</p>
          <p className="text-xs text-muted-foreground">{personalityData.badge_text}</p>
        </div>
      </div>
    </motion.div>
  );
};
