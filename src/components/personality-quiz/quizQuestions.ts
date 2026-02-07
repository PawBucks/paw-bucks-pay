import { QuizQuestion } from './types';

type PetType = 'dog' | 'cat' | 'bird' | 'reptile' | 'rabbit' | 'other';

// Dog-specific questions
const dogQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "When someone knocks on the door, your dog...",
    context: "🚪 The doorbell rings!",
    options: [
      { id: "1a", text: "Hides under the couch or bed", emoji: "🛋️", personality: "couch_potato" },
      { id: "1b", text: "Barks like a tiny warrior defending the realm", emoji: "🛡️", personality: "guard_dog" },
      { id: "1c", text: "Completely ignores it and continues their business", emoji: "😼", personality: "chaotic_neutral" },
      { id: "1d", text: "Runs to the door, tail wagging, ready to meet their new best friend", emoji: "🦋", personality: "social_butterfly" }
    ]
  },
  {
    id: 2,
    question: "On a walk, your dog...",
    context: "🚶 Time for walkies!",
    options: [
      { id: "2a", text: "Wants to turn around and go home after 5 minutes", emoji: "🛋️", personality: "couch_potato" },
      { id: "2b", text: "Patrols the route, checking every corner for threats", emoji: "🛡️", personality: "guard_dog" },
      { id: "2c", text: "Goes wherever THEY want, you're just along for the ride", emoji: "😼", personality: "chaotic_neutral" },
      { id: "2d", text: "Wants to meet every person and dog they see", emoji: "🦋", personality: "social_butterfly" },
      { id: "2e", text: "Could walk forever, sniffing and exploring everything", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 3,
    question: "When you're eating dinner, your dog...",
    context: "🍽️ Dinner time for the humans!",
    options: [
      { id: "3a", text: "Sleeps through the whole thing", emoji: "🛋️", personality: "couch_potato" },
      { id: "3b", text: "Sits guard nearby, watching for any danger", emoji: "🛡️", personality: "guard_dog" },
      { id: "3c", text: "Plots ways to steal food when you're not looking", emoji: "😼", personality: "chaotic_neutral" },
      { id: "3d", text: "Goes from person to person, charming everyone for scraps", emoji: "🦋", personality: "social_butterfly" },
      { id: "3e", text: "Too busy playing with toys to notice", emoji: "🏔️", personality: "adventurer" }
    ]
  }
];

// Cat-specific questions
const catQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "When you come home, your cat...",
    context: "🏠 You're finally home!",
    options: [
      { id: "1a", text: "Doesn't even open their eyes from their nap spot", emoji: "🛋️", personality: "couch_potato" },
      { id: "1b", text: "Watches you from a high perch, assessing if you're friend or foe", emoji: "🛡️", personality: "guard_dog" },
      { id: "1c", text: "Knocks something off a shelf to remind you who's boss", emoji: "😼", personality: "chaotic_neutral" },
      { id: "1d", text: "Runs to greet you with meows and leg rubs", emoji: "🦋", personality: "social_butterfly" },
      { id: "1e", text: "Immediately wants to explore what you brought in", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 2,
    question: "At 3 AM, your cat is usually...",
    context: "🌙 The witching hour!",
    options: [
      { id: "2a", text: "Sound asleep, dreaming of treats", emoji: "🛋️", personality: "couch_potato" },
      { id: "2b", text: "Patrolling the house, keeping watch", emoji: "🛡️", personality: "guard_dog" },
      { id: "2c", text: "Causing chaos - zoomies, yelling, or knocking things over", emoji: "😼", personality: "chaotic_neutral" },
      { id: "2d", text: "Cuddled up next to you in bed", emoji: "🦋", personality: "social_butterfly" },
      { id: "2e", text: "Hunting invisible prey or exploring forbidden areas", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 3,
    question: "When you bring out a new toy, your cat...",
    context: "🧸 New toy alert!",
    options: [
      { id: "3a", text: "Glances at it, then goes back to sleep", emoji: "🛋️", personality: "couch_potato" },
      { id: "3b", text: "Approaches cautiously, testing for danger", emoji: "🛡️", personality: "guard_dog" },
      { id: "3c", text: "Ignores the toy, plays with the box instead", emoji: "😼", personality: "chaotic_neutral" },
      { id: "3d", text: "Brings it to you to play together", emoji: "🦋", personality: "social_butterfly" },
      { id: "3e", text: "Immediately pounces and carries it around the house", emoji: "🏔️", personality: "adventurer" }
    ]
  }
];

// Bird-specific questions
const birdQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "When they see themselves in a mirror, your bird...",
    context: "🪞 Mirror mirror on the wall!",
    options: [
      { id: "1a", text: "Ignores it and takes a nap on their favorite perch", emoji: "🛋️", personality: "couch_potato" },
      { id: "1b", text: "Puffs up and tries to intimidate the 'intruder'", emoji: "🛡️", personality: "guard_dog" },
      { id: "1c", text: "Screams at it unpredictably, then acts like nothing happened", emoji: "😼", personality: "chaotic_neutral" },
      { id: "1d", text: "Tries to befriend and talk to their reflection", emoji: "🦋", personality: "social_butterfly" },
      { id: "1e", text: "Climbs around inspecting every angle of this new discovery", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 2,
    question: "When you're on a video call, your bird...",
    context: "💻 Important meeting time!",
    options: [
      { id: "2a", text: "Quietly preens or sleeps in the background", emoji: "🛋️", personality: "couch_potato" },
      { id: "2b", text: "Watches the screen suspiciously, ready to defend you", emoji: "🛡️", personality: "guard_dog" },
      { id: "2c", text: "Screams at the worst possible moment", emoji: "😼", personality: "chaotic_neutral" },
      { id: "2d", text: "Tries to get on camera and chat with the people", emoji: "🦋", personality: "social_butterfly" },
      { id: "2e", text: "Takes the opportunity to explore while you're distracted", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 3,
    question: "At treat time, your bird...",
    context: "🍎 Snack time!",
    options: [
      { id: "3a", text: "Takes their time, casually nibbling", emoji: "🛋️", personality: "couch_potato" },
      { id: "3b", text: "Guards the treat from imaginary competitors", emoji: "🛡️", personality: "guard_dog" },
      { id: "3c", text: "Throws half of it on the floor, then screams for more", emoji: "😼", personality: "chaotic_neutral" },
      { id: "3d", text: "Wants to share and feed treats back to you", emoji: "🦋", personality: "social_butterfly" },
      { id: "3e", text: "Plays with it, tosses it around, treats it like a toy", emoji: "🏔️", personality: "adventurer" }
    ]
  }
];

// Reptile-specific questions
const reptileQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "When you approach their enclosure, your reptile...",
    context: "👀 You've been spotted!",
    options: [
      { id: "1a", text: "Stays completely still, conserving energy", emoji: "🛋️", personality: "couch_potato" },
      { id: "1b", text: "Puffs up or displays, warning you to keep distance", emoji: "🛡️", personality: "guard_dog" },
      { id: "1c", text: "Does something completely unpredictable", emoji: "😼", personality: "chaotic_neutral" },
      { id: "1d", text: "Comes to the glass, expecting interaction", emoji: "🦋", personality: "social_butterfly" },
      { id: "1e", text: "Starts exploring, climbing, or investigating", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 2,
    question: "During handling time, your reptile...",
    context: "🤲 Time for some bonding!",
    options: [
      { id: "2a", text: "Settles in and barely moves", emoji: "🛋️", personality: "couch_potato" },
      { id: "2b", text: "Stays alert, watching everything around them", emoji: "🛡️", personality: "guard_dog" },
      { id: "2c", text: "Has a 50/50 chance of being chill or trying to escape", emoji: "😼", personality: "chaotic_neutral" },
      { id: "2d", text: "Seems to enjoy the warmth and attention", emoji: "🦋", personality: "social_butterfly" },
      { id: "2e", text: "Immediately wants to climb and explore you", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 3,
    question: "At feeding time, your reptile...",
    context: "🦗 Dinner is served!",
    options: [
      { id: "3a", text: "Waits for food to come close, minimal effort", emoji: "🛋️", personality: "couch_potato" },
      { id: "3b", text: "Strikes with precision, protecting their territory", emoji: "🛡️", personality: "guard_dog" },
      { id: "3c", text: "Sometimes eats, sometimes ignores it for no reason", emoji: "😼", personality: "chaotic_neutral" },
      { id: "3d", text: "Eats from your hand if you offer", emoji: "🦋", personality: "social_butterfly" },
      { id: "3e", text: "Actively hunts, stalks, and chases their food", emoji: "🏔️", personality: "adventurer" }
    ]
  }
];

// Rabbit-specific questions
const rabbitQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "When you open their enclosure, your rabbit...",
    context: "🚪 Freedom awaits!",
    options: [
      { id: "1a", text: "Stays in their cozy spot, why leave comfort?", emoji: "🛋️", personality: "couch_potato" },
      { id: "1b", text: "Thumps their foot, alerting everyone to the change", emoji: "🛡️", personality: "guard_dog" },
      { id: "1c", text: "Might come out, might not—depends on their mood", emoji: "😼", personality: "chaotic_neutral" },
      { id: "1d", text: "Hops right over for pets and cuddles", emoji: "🦋", personality: "social_butterfly" },
      { id: "1e", text: "Immediately binkies and zooms around exploring", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 2,
    question: "When you bring out fresh veggies, your rabbit...",
    context: "🥬 Veggie time!",
    options: [
      { id: "2a", text: "Slowly hops over, takes one piece, and goes back to lounging", emoji: "🛋️", personality: "couch_potato" },
      { id: "2b", text: "Grabs a piece and retreats to a safe corner to eat", emoji: "🛡️", personality: "guard_dog" },
      { id: "2c", text: "Throws veggies around, demanding only their favorites", emoji: "😼", personality: "chaotic_neutral" },
      { id: "2d", text: "Eats while sitting on your lap or near you", emoji: "🦋", personality: "social_butterfly" },
      { id: "2e", text: "Grabs a piece and runs victory laps with it", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 3,
    question: "When you're sitting on the floor, your rabbit...",
    context: "🧘 Floor time!",
    options: [
      { id: "3a", text: "Flops down nearby and naps", emoji: "🛋️", personality: "couch_potato" },
      { id: "3b", text: "Keeps a watchful eye on you from a distance", emoji: "🛡️", personality: "guard_dog" },
      { id: "3c", text: "Chews on something they shouldn't be chewing on", emoji: "😼", personality: "chaotic_neutral" },
      { id: "3d", text: "Climbs on you, demands pets, and grooms you back", emoji: "🦋", personality: "social_butterfly" },
      { id: "3e", text: "Uses you as an obstacle in their parkour course", emoji: "🏔️", personality: "adventurer" }
    ]
  }
];

// Generic questions for other pet types
const otherQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "When you approach your pet, they usually...",
    context: "👋 Hello there!",
    options: [
      { id: "1a", text: "Stay relaxed in their favorite spot", emoji: "🛋️", personality: "couch_potato" },
      { id: "1b", text: "Watch you carefully, assessing the situation", emoji: "🛡️", personality: "guard_dog" },
      { id: "1c", text: "React unpredictably—sometimes interested, sometimes not", emoji: "😼", personality: "chaotic_neutral" },
      { id: "1d", text: "Show excitement and seek interaction", emoji: "🦋", personality: "social_butterfly" },
      { id: "1e", text: "Start moving around, ready for activity", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 2,
    question: "During feeding time, your pet...",
    context: "🍽️ Yummy time!",
    options: [
      { id: "2a", text: "Takes their time, no rush at all", emoji: "🛋️", personality: "couch_potato" },
      { id: "2b", text: "Carefully inspects food before eating", emoji: "🛡️", personality: "guard_dog" },
      { id: "2c", text: "Has specific preferences and might refuse for no reason", emoji: "😼", personality: "chaotic_neutral" },
      { id: "2d", text: "Seems happiest when you're involved in feeding", emoji: "🦋", personality: "social_butterfly" },
      { id: "2e", text: "Gets active and excited, moves around a lot", emoji: "🏔️", personality: "adventurer" }
    ]
  },
  {
    id: 3,
    question: "Most of the time, your pet can be found...",
    context: "🔍 Where are they?",
    options: [
      { id: "3a", text: "In their favorite cozy resting spot", emoji: "🛋️", personality: "couch_potato" },
      { id: "3b", text: "In a spot where they can observe everything", emoji: "🛡️", personality: "guard_dog" },
      { id: "3c", text: "Somewhere unexpected—they keep you guessing", emoji: "😼", personality: "chaotic_neutral" },
      { id: "3d", text: "Near you or other family members", emoji: "🦋", personality: "social_butterfly" },
      { id: "3e", text: "Exploring or investigating something new", emoji: "🏔️", personality: "adventurer" }
    ]
  }
];

// Map pet types to their question sets
const questionsByPetType: Record<PetType, QuizQuestion[]> = {
  dog: dogQuestions,
  cat: catQuestions,
  bird: birdQuestions,
  reptile: reptileQuestions,
  rabbit: rabbitQuestions,
  other: otherQuestions,
};

export const getQuestionsForPetType = (petType: string): QuizQuestion[] => {
  const normalizedType = petType?.toLowerCase() as PetType;
  return questionsByPetType[normalizedType] || questionsByPetType.other;
};

// Keep for backward compatibility
export const quizQuestions = dogQuestions;
