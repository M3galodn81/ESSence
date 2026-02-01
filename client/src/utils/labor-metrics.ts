/**
 * Configuration for Labor Cost Performance Metrics
 * Easily edit limits and UI messages here.
 */
const LABOR_THRESHOLDS = [
  {
    max: 11,
    status: "Excellent",
    rating: "good",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    description: "Excellent! Your labor cost is optimized, maximizing your bottom line.",
  },
  {
    max: 12,
    status: "Good",
    rating: "good",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    description: "Great! You are hitting the 12% ideal target. Maintain this balance.",
  },
  {
    max: Infinity,
    status: "Warning",
    rating: "warning",
    color: "bg-rose-100 text-rose-700 border-rose-200",
    description: "Warning: Labor costs have exceeded the 12% ideal limit. Review shifts and overtime.",
  },
];

const IDEAL_TARGET = 12;