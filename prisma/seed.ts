import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  isolatedWordsPerQuiz: 10,
  newWordsPerLesson: 2,
  weakWordsPerLesson: 4,
  reviewWordsPerLesson: 4,
  masteredWordsPerLesson: 6,
  ratioMastered: 70,
  ratioReview: 20,
  ratioNew: 10,
};

/**
 * Optional convenience seed: creates a demo account so you can log in
 * immediately. Safe to run repeatedly (no-op if the user exists).
 *
 *   Email:    demo@arabic.local
 *   Password: demo1234
 */
async function main() {
  const email = "demo@arabic.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists — nothing to do.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: "Demo Learner",
      passwordHash,
      settings: { create: DEFAULT_SETTINGS },
    },
  });

  // A handful of starter words so the UI isn't empty.
  const starters = [
    { arabic: "كتب", harakat: "كَتَبَ", en: "to write", type: "VERB", root: "ك-ت-ب", past: "كَتَبَ", present: "يَكْتُبُ", masdar: "كِتَابَة" },
    { arabic: "قرأ", harakat: "قَرَأَ", en: "to read", type: "VERB", root: "ق-ر-أ", past: "قَرَأَ", present: "يَقْرَأُ", masdar: "قِرَاءَة" },
    { arabic: "مسجد", harakat: "مَسْجِد", en: "mosque", type: "NOUN", root: "س-ج-د", plural: "مَسَاجِد" },
    { arabic: "كتاب", harakat: "كِتَاب", en: "book", type: "NOUN", root: "ك-ت-ب", plural: "كُتُب" },
    { arabic: "بيت", harakat: "بَيْت", en: "house", type: "NOUN", root: "ب-ي-ت", plural: "بُيُوت" },
    { arabic: "كبير", harakat: "كَبِير", en: "big, large", type: "ADJECTIVE", masculine: "كَبِير", feminine: "كَبِيرَة" },
  ];

  for (const s of starters) {
    await prisma.vocabularyItem.create({
      data: {
        userId: user.id,
        arabic: s.arabic,
        arabicWithHarakat: s.harakat,
        englishMeaning: s.en,
        type: s.type as never,
        root: s.root ?? null,
        pastTense: s.past ?? null,
        presentTense: s.present ?? null,
        masdar: s.masdar ?? null,
        plural: s.plural ?? null,
        masculine: s.masculine ?? null,
        feminine: s.feminine ?? null,
        sourceType: "MANUAL",
        status: "NEW",
        nextReviewAt: new Date(),
      },
    });
  }

  console.log("Seeded demo user (demo@arabic.local / demo1234) with starter words.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
