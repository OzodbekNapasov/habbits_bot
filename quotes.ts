/**
 * Curated collection of Uzbek motivational quotes for habit tracking.
 */
export const UZBEK_MOTIVATIONAL_QUOTES: string[] = [
  "💡 Muvaffaqiyat — har kuni takrorlanadigan kichik intizomlar yig'indisidir.",
  "⚡ Bugungi mehnatingiz — ertangi g'alabangiz poydevoridir.",
  "🚀 Har bir buyuk natija birinchi kichik qadamdan boshlanadi.",
  "🎯 Intizom — bu xohlagan narsangiz va eng ko'p xohlagan narsangiz o'rtasidagi tanlovdir.",
  "🔥 Odatlaringizni o'zgartiring, hayotingiz o'zgaradi!",
  "🌟 Kichik qadamlar har kuni katta natijalarga olib keladi.",
  "🏆 Maqsad sari qo'yilgan har bir intizomli qadam zafarga eltadi.",
  "💪 Bugun bajargan harakatlaringiz uchun ertaga o'zingizga rahmat aytasiz.",
  "⏰ Har bir daqiqa o'z maqsadlaringizga yaqinlashish uchun imkoniyatdir.",
  "✨ Doimiylik va intizom har qanday iste'doddan ustundir.",
];

/**
 * Returns a random motivational quote in Uzbek.
 */
export function getRandomQuote(): string {
  const randomIndex = Math.floor(Math.random() * UZBEK_MOTIVATIONAL_QUOTES.length);
  return UZBEK_MOTIVATIONAL_QUOTES[randomIndex];
}
