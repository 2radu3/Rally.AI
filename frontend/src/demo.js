// Demo mode: used for the static GitHub Pages build (no backend).
// Set VITE_DEMO=true at build time to enable it.
export const DEMO = import.meta.env.VITE_DEMO === 'true';

// Sample results shown in demo mode. The heatmap is the real data in
// public/web_input.txt; the numbers below are SAMPLE values.
// Replace them with the values from your own output/analysis.json.
export const demoStats = {
  total_shots: 142,
  smash_count: 14,
  forehand_count: 71,
  backhand_count: 57,
  shots_per_minute: 11.8,
  total_players: 4,
  duration: 722,
  resolution: '1920x1080',
};

export const demoPerPlayer = {
  P1: { total: 41, forehand: 21, backhand: 16, smash: 4 },
  P2: { total: 35, forehand: 17, backhand: 15, smash: 3 },
  P3: { total: 38, forehand: 19, backhand: 14, smash: 5 },
  P4: { total: 28, forehand: 14, backhand: 12, smash: 2 },
};
