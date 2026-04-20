// Developer feature flags — set before deploying to the marketplace.
// false = feature is completely hidden: no menu item, no preference toggle,
//         and any server-side calls are blocked with a clear error.
const DEV_FLAGS = {
  AI_LESSON:   true,   // AI Lesson Generator ("Generate Shiur Draft")
  SURPRISE_ME: true,   // Surprise Me dialog
};
