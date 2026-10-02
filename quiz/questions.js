/* The reader-feedback quiz at /quiz, as data.

   One list drives the quiz screens, the organiser's results, and the
   Firestore rules that check every answer (firestore.rules is generated
   from this list, so they can't drift apart). Change a question here, then
   regenerate the rules block before publishing.

   Every answer is optional except where `required` is set, and nothing
   identifies the person: no name, no email, no account.

   Types:
     single  one tap, moves on by itself
     multi   chips, up to `max`, then Next
     scale   1..max, one tap
     nps     0..10, one tap
     text    a short note, skippable
   `other: true` adds a "something else" box, stored as `<id>Other`.
   `also: { time: [...] }` asks the question of anyone else too, when their
   answer to `time` is one of those, right after that question.          */

export const VERSION = 1;

export const PATHS = {
  regular: "Yes, I come often",
  sometimes: "Once or a few times",
  never: "Not yet",
};
const ALL = ["regular", "sometimes", "never"];
const CAME = ["regular", "sometimes"];

const WHEN = [["yes", "Yes, definitely"], ["usually", "Usually works"], ["sometimes", "Sometimes"],
  ["rarely", "Usually doesn't"], ["no", "No, not convenient"]];
const MORE = [["silent", "Silent reading"], ["discuss", "Book discussions"], ["exchange", "Book exchange"],
  ["games", "Games & activities"], ["workshops", "Workshops"], ["social", "Breakfasts & meet-ups"]];
const AWAY = [["busy", "Sunday mornings get busy"], ["early", "8:30 is too early for me"],
  ["far", "It's far, or hard to get to"], ["weather", "Weather: heat, rain"]];

export const QUESTIONS = [
  { id: "path", type: "single", paths: ALL, required: true, kicker: "First things first",
    q: "Have you been to a Pages of Panvel Sunday?",
    options: Object.entries(PATHS) },

  // ── people who've come ──
  { id: "rating", type: "scale", max: 5, paths: CAME, required: true, kicker: "The experience",
    q: "How has Pages of Panvel been for you, overall?", low: "Meh", high: "Love it" },
  { id: "why", type: "multi", max: 3, other: true, paths: CAME, kicker: "Why you come",
    q: "What do you enjoy most?",
    options: [["people", "The people"], ["time", "Protected reading time"], ["discover", "Discovering books"],
      ["talk", "The conversations"], ["park", "Mornings in the park"], ["ritual", "A Sunday ritual"],
      ["swap", "Swapping books"], ["library", "The Open Library"], ["belong", "Feeling part of something"]] },
  { id: "barriers", type: "multi", max: 4, other: true, paths: ["sometimes"], kicker: "Honest bit",
    q: "What keeps you from coming more often?",
    options: [...AWAY, ["alone", "I don't know many people yet"], ["awkward", "Felt a bit out of place"],
      ["reading", "Not reading much lately"], ["forget", "I forget it's on"], ["format", "The format isn't quite me"]] },
  { id: "time", type: "single", paths: CAME, required: true, kicker: "The Sunday line",
    q: "Sunday, 8:30 to 10 in the morning. Does it work for you?", options: WHEN },
  { id: "venue", type: "single", paths: CAME, required: true, kicker: "The Sunday line",
    q: "How do you feel about our venues?",
    options: [["happy", "Satisfied"], ["neutral", "Neutral"], ["unhappy", "Dissatisfied"], ["new", "Haven't come enough to say"]] },
  { id: "venuePref", type: "single", paths: CAME, required: true, kicker: "The Sunday line",
    q: "Would you rather have…",
    options: [["one", "One regular venue"], ["rotate", "Different places"], ["mostly", "Mostly one, sometimes new ones"], ["any", "No preference"]] },
  { id: "welcome", type: "single", paths: CAME, required: true, kicker: "People & conversations",
    q: "Do you feel welcome when you come?",
    options: [["yes", "Yes, definitely"], ["sometimes", "Sometimes"], ["no", "Not really"]] },
  { id: "meet", type: "single", paths: CAME, required: true, kicker: "People & conversations",
    q: "Is it easy to meet and talk to other members?",
    options: [["easy", "Very easy"], ["neutral", "Neither easy nor hard"], ["hard", "Quite difficult"]] },

  // ── people who haven't come yet ──
  { id: "away", type: "multi", max: 4, other: true, paths: ["never"], kicker: "Honest bit",
    q: "What's kept you away so far?",
    options: [["new", "Only just heard about it"], ...AWAY, ["alone", "I wouldn't know anyone"],
      ["unsure", "Not sure it's for me"], ["reader", "I'm not much of a reader (yet)"], ["solo", "I prefer reading alone"]] },
  { id: "draw", type: "multi", max: 3, other: true, paths: ["never"], kicker: "What would change it",
    q: "What would get you there?",
    options: [["friend", "A friend coming with me"], ["time", "A different time"], ["closer", "A venue closer to me"],
      ["first", "A first-timers' session"], ["know", "Knowing what actually happens"], ["theme", "A theme or book I love"],
      ["nothing", "Honestly, nothing right now"]] },
  { id: "slots", type: "multi", max: 5, paths: ["never"], also: { time: ["rarely", "no"] }, kicker: "What would change it",
    q: "When would suit you best?",
    options: [["satam", "Saturday morning"], ["satpm", "Saturday evening"], ["sunam", "Sunday morning"],
      ["sunpm", "Sunday evening"], ["weekday", "A weekday evening"]] },
  { id: "likely", type: "single", paths: ["never"], required: true, kicker: "Be honest",
    q: "How likely are you to come in the next month?",
    options: [["no", "Not likely"], ["maybe", "Maybe"], ["likely", "Likely"], ["yes", "I'll be there"]] },

  // ── everyone ──
  { id: "more", type: "multi", max: 6, other: true, paths: ALL, kicker: "What you want more of",
    q: "What would you like to see more of?", options: MORE },
  { id: "heard", type: "single", other: true, paths: ALL, required: true, kicker: "Growth & reach",
    q: "How did you first hear about us?",
    options: [["friend", "A friend told me"], ["member", "A POP member"], ["instagram", "Instagram"], ["chatgpt", "ChatGPT"],
      ["facebook", "Facebook"], ["reddit", "Reddit"], ["google", "Googling"], ["other", "Somewhere else"]] },
  { id: "nps", type: "nps", paths: CAME, required: true, kicker: "Growth & reach",
    q: "How likely are you to recommend Pages of Panvel to a friend?", low: "Not at all", high: "Absolutely" },
  { id: "vibe", type: "single", paths: ALL, required: true, kicker: "Just for fun",
    q: "Pick your reading vibe.",
    options: [["chai", "Chai and a classic"], ["thriller", "A page-turner at 2am"], ["poetry", "Poetry on a park bench"],
      ["nonfic", "Non-fiction, pen in hand"], ["desi", "मराठी, हिंदी greats"], ["comics", "Comics & graphic novels"]] },
  { id: "change", type: "text", paths: ALL, kicker: "Make it better",
    q: "One thing we should change, or start doing?", placeholder: "Big or small, all of it helps" },
  { id: "uncomfortable", type: "text", paths: CAME, kicker: "Make it better",
    q: "Was anything inconvenient or uncomfortable?", placeholder: "Totally anonymous. Be as honest as you like." },
  { id: "curator", type: "text", paths: ALL, kicker: "If you were running this…",
    q: "You're curator of POP for a day. What's the first thing you do?", placeholder: "Go wild" },
];

// Every key an answer may carry, for the rules and the results.
export const KEYS = QUESTIONS.flatMap((q) => (q.other ? [q.id, q.id + "Other"] : [q.id])).filter((k) => k !== "path");
export const TEXT_MAX = 600;

// Who you are, by your vibe. Shown at the end; never stored beyond the vibe itself.
export const PERSONAS = {
  chai: ["The Chai Classicist", "Old favourites, a hot cup, no rush. You make Sunday feel like Sunday."],
  thriller: ["The 2am Page-Turner", "'One more chapter' is a promise you break every single night."],
  poetry: ["The Bench Poet", "You read slowly, underline everything, and read the best bit out loud."],
  nonfic: ["The Margin Scribbler", "Pen in hand, questions in the margins, a fact for every conversation."],
  desi: ["The Vernacular Voyager", "मराठी, हिंदी and back again. You keep the circle's shelf rooted."],
  comics: ["The Panel Hopper", "Pictures, panels, punchlines. Proof a great story needs no rules."],
};
