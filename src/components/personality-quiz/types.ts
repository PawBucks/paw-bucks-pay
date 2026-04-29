export interface QuizQuestion {
 id: number;
 question: string;
 context: string;
 options: QuizOption[];
}

export interface QuizOption {
 id: string;
 text: string;
 emoji: string;
 personality: PersonalityType;
}

export type PersonalityType = 
 |'couch_potato' 
 |'guard_dog' 
 |'chaotic_neutral' 
 |'social_butterfly' 
 |'adventurer';

export interface PersonalityResult {
 type_key: string;
 name: string;
 emoji: string;
 tagline: string;
 description: string;
 avatar_style: string;
 color_primary: string;
 color_secondary: string;
 traits: string[];
 tips: string[];
 badge_text: string;
}

export interface QuizState {
 currentQuestion: number;
 answers: Record<number, PersonalityType>;
 isComplete: boolean;
 result: PersonalityResult | null;
}
