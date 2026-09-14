// Sample circle, used only when the page is opened with ?demo in the URL.
// Nothing here touches Firebase. Delete this file once you're live if you like.

const d = (back) => {
  const x = new Date();
  x.setDate(x.getDate() - back);
  return x.toISOString().slice(0, 10);
};

// A run of consecutive days ending today, for streaks.
const run = (n, skip = 0) =>
  Array.from({ length: n }, (_, i) => d(i + skip));

export const DEMO_UID = "u-nitya";

export const DEMO_PUBLIC = {
  members: {
    "u-nitya":   { name: "Nitya",    joined: d(90), days: run(11) },
    "u-farid":   { name: "Farid",    joined: d(84), days: run(23) },
    "u-shalini": { name: "Shalini",  joined: d(70), days: run(6) },
    "u-omkar":   { name: "Omkar",    joined: d(65), days: run(14) },
    "u-rhea":    { name: "Rhea",     joined: d(60), days: run(4, 2) },
    "u-arif":    { name: "Arif",     joined: d(45), days: run(9) },
    "u-manju":   { name: "Manjusha", joined: d(30), days: run(2) },
    "u-dev":     { name: "Devika",   joined: d(21), days: run(17) },
  },
  books: [
    { id: "b1", uid: "u-nitya", title: "The Enchantress of Florence", author: "Salman Rushdie",
      genre: "Fiction", lang: "English", status: "reading", startedAt: d(6),
      line: "A story is a map of the places a person is afraid to go.", lendable: false },
    { id: "b2", uid: "u-farid", title: "The Enchantress of Florence", author: "Salman Rushdie",
      genre: "Fiction", lang: "English", status: "reading", startedAt: d(3), line: "", lendable: true },
    { id: "b3", uid: "u-shalini", title: "कोसला", author: "भालचंद्र नेमाडे",
      genre: "Fiction", lang: "मराठी", status: "reading", startedAt: d(9), line: "", lendable: false },
    { id: "b4", uid: "u-omkar", title: "Annihilation", author: "Jeff VanderMeer",
      genre: "Sci-fi & fantasy", lang: "English", status: "finished", startedAt: d(26),
      finishedAt: d(5), line: "", lendable: true },
    { id: "b5", uid: "u-nitya", title: "A Fine Balance", author: "Rohinton Mistry",
      genre: "Fiction", lang: "English", status: "finished", startedAt: d(40),
      finishedAt: d(12), line: "", lendable: true },
    { id: "b6", uid: "u-rhea", title: "गुनाहों का देवता", author: "धर्मवीर भारती",
      genre: "Fiction", lang: "हिंदी", status: "reading", startedAt: d(4), line: "", lendable: false },
    { id: "b7", uid: "u-arif", title: "The Sea Around Us", author: "Rachel Carson",
      genre: "Science", lang: "English", status: "reading", startedAt: d(11),
      line: "The sea has always challenged the minds of men.", lendable: false },
    { id: "b8", uid: "u-manju", title: "Em and the Big Hoom", author: "Jerry Pinto",
      genre: "Fiction", lang: "English", status: "reading", startedAt: d(2), line: "", lendable: false },
    { id: "b9", uid: "u-dev", title: "Collected Poems", author: "Arun Kolatkar",
      genre: "Poetry", lang: "English", status: "reading", startedAt: d(8), line: "", lendable: true },
    { id: "b10", uid: "u-dev", title: "The Mahabharata", author: "translated by Bibek Debroy",
      genre: "History", lang: "English", status: "reading", startedAt: d(35), line: "", lendable: false },
    { id: "b11", uid: "u-farid", title: "Maus", author: "Art Spiegelman",
      genre: "Graphic novel", lang: "English", status: "finished", startedAt: d(30),
      finishedAt: d(18), line: "", lendable: true },
    { id: "b12", uid: "u-omkar", title: "Annapurna", author: "Maurice Herzog",
      genre: "Memoir", lang: "English", status: "reading", startedAt: d(7), line: "", lendable: false },
    { id: "b13", uid: "u-shalini", title: "The Argumentative Indian", author: "Amartya Sen",
      genre: "Essays", lang: "English", status: "reading", startedAt: d(13), line: "", lendable: false },
    { id: "b14", uid: "u-nitya", title: "Collected Poems", author: "Arun Kolatkar",
      genre: "Poetry", lang: "English", status: "reading", startedAt: d(1), line: "", lendable: false },
    { id: "b15", uid: "u-arif", title: "Midnight's Children", author: "Salman Rushdie",
      genre: "Fiction", lang: "English", status: "finished", startedAt: d(50),
      finishedAt: d(20), line: "", lendable: false },
    { id: "b16", uid: "u-dev", title: "The Tale of Genji", author: "Murasaki Shikibu",
      genre: "Fiction", lang: "English", status: "reading", startedAt: d(16), line: "", lendable: false },
    { id: "b17", uid: "u-manju", title: "Silent Spring", author: "Rachel Carson",
      genre: "Science", lang: "English", status: "finished", startedAt: d(28),
      finishedAt: d(9), line: "", lendable: true },
    { id: "b18", uid: "u-rhea", title: "Persepolis", author: "Marjane Satrapi",
      genre: "Graphic novel", lang: "English", status: "reading", startedAt: d(5), line: "", lendable: false },
  ],
  board: [
    { id: "p1", uid: "u-arif", text: "Want to read out the bit about the deep sea. Two minutes, I promise.", at: d(2) },
    { id: "p2", uid: "u-shalini", text: "Does anyone else find Kosla unbearable and brilliant at the same time?", at: d(3) },
    { id: "p3", uid: "u-dev", text: "Bringing the Kolatkar. Someone please take it off me for a month.", at: d(4) },
  ],
};

export const DEMO_PRIVATE = {
  books: [
    { id: "pv1", uid: DEMO_UID, title: "The Year of Magical Thinking", author: "Joan Didion",
      genre: "Memoir", lang: "English", status: "reading", startedAt: d(10), line: "", lendable: false },
  ],
};
