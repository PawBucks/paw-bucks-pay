import { QuizQuestion } from './types';

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "When someone knocks on the door, your pet...",
    context: "🚪 The doorbell rings!",
    options: [
      {
        id: "1a",
        text: "Hides under the couch or bed",
        emoji: "🛋️",
        personality: "couch_potato"
      },
      {
        id: "1b", 
        text: "Barks like a tiny warrior defending the realm",
        emoji: "🛡️",
        personality: "guard_dog"
      },
      {
        id: "1c",
        text: "Completely ignores it and continues their business",
        emoji: "😼",
        personality: "chaotic_neutral"
      },
      {
        id: "1d",
        text: "Runs to the door, tail wagging, ready to meet their new best friend",
        emoji: "🦋",
        personality: "social_butterfly"
      }
    ]
  },
  {
    id: 2,
    question: "On a walk, your pet...",
    context: "🚶 Time for walkies!",
    options: [
      {
        id: "2a",
        text: "Wants to turn around and go home after 5 minutes",
        emoji: "🛋️",
        personality: "couch_potato"
      },
      {
        id: "2b",
        text: "Patrols the route, checking every corner for threats",
        emoji: "🛡️",
        personality: "guard_dog"
      },
      {
        id: "2c",
        text: "Goes wherever THEY want, you're just along for the ride",
        emoji: "😼",
        personality: "chaotic_neutral"
      },
      {
        id: "2d",
        text: "Wants to meet every person and dog they see",
        emoji: "🦋",
        personality: "social_butterfly"
      },
      {
        id: "2e",
        text: "Could walk forever, sniffing and exploring everything",
        emoji: "🏔️",
        personality: "adventurer"
      }
    ]
  },
  {
    id: 3,
    question: "When you're eating dinner, your pet...",
    context: "🍽️ Dinner time for the humans!",
    options: [
      {
        id: "3a",
        text: "Sleeps through the whole thing",
        emoji: "🛋️",
        personality: "couch_potato"
      },
      {
        id: "3b",
        text: "Sits guard nearby, watching for any danger",
        emoji: "🛡️",
        personality: "guard_dog"
      },
      {
        id: "3c",
        text: "Plots ways to steal food when you're not looking",
        emoji: "😼",
        personality: "chaotic_neutral"
      },
      {
        id: "3d",
        text: "Goes from person to person, charming everyone for scraps",
        emoji: "🦋",
        personality: "social_butterfly"
      },
      {
        id: "3e",
        text: "Too busy playing with toys to notice",
        emoji: "🏔️",
        personality: "adventurer"
      }
    ]
  }
];
