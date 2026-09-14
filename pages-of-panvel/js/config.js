// Firebase settings for the Pages of Panvel circle.
//
// These values are meant to be public. They identify the project, they don't
// grant access to it. What protects the data is firestore.rules plus the
// allowlist collection.

export const firebaseConfig = {
  apiKey: "AIzaSyDAPimL4D4vUIZ0UqZUdegTlEeAYp7jbmg",
  authDomain: "pages-of-panvel.firebaseapp.com",
  projectId: "pages-of-panvel",
  storageBucket: "pages-of-panvel.firebasestorage.app",
  messagingSenderId: "212923062247",
  appId: "1:212923062247:web:a4f7a113c5f50c08bd8f42",
};

// Where and when you meet. Shows up in the header and the WhatsApp round-up.
export const CIRCLE = {
  name: "Pages of Panvel",
  where: "the park",
  when: "Sundays, 8am",
};
