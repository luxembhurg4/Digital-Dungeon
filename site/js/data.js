'use strict';

/* ============================================================
 * Dungeon of Tabs — game data
 * All coordinates are tile coordinates from the master plan.
 * ============================================================ */

const WORLD = { TILE: 16, COLS: 24, ROWS: 18, W: 384, H: 288 };
const SPEED = 64;            // world px per second (master plan suggestion)
const POSE_FPS = 8;          // walk pose changes per second

const ROOMS = [
  { id: 'gate',               name: 'Gate',               eyebrow: 'ROOM 01 / 08 · MEET THE ADVENTURER' },
  { id: 'profile-hall',       name: 'Profile Hall',       eyebrow: 'ROOM 02 / 08 · MY DIGITAL MEDIA PROFILE' },
  { id: 'analysis-chamber',   name: 'Analysis Chamber',   eyebrow: 'ROOM 03 / 08 · TEN QUESTIONS, TEN ANSWERS' },
  { id: 'router-quest',       name: 'Router Quest',       eyebrow: 'ROOM 04 / 08 · WHEN TECH SCARED ME' },
  { id: 'reel-trap',          name: 'Reel Trap',          eyebrow: 'ROOM 05 / 08 · MY REAL WEAKNESS' },
  { id: 'plan-armory',        name: 'Plan Armory',        eyebrow: 'ROOM 06 / 08 · 7-DAY DIGITAL WELLNESS PLAN' },
  { id: 'infographic-vault',  name: 'Infographic Vault',  eyebrow: 'ROOM 07 / 08 · MY HEALTHIER DIGITAL LIFE' },
  { id: 'exit',               name: 'Exit',               eyebrow: 'ROOM 08 / 08 · MY ONE CHANGE' }
];

/* Hallway index i connects ROOMS[i] -> ROOMS[i+1] */
const HALLWAYS = [
  {
    n: 1, title: 'The Arrival Hall',
    spawn: [11, 14],
    dest: [[11, 2], [12, 2]],
    arrival: [[11, 15], [12, 15]],
    walkable: [[8, 2, 15, 7], [10, 7, 13, 12], [5, 12, 18, 15]],
    blockedRects: [],
    props: [[8, 3], [15, 3], [6, 13], [17, 13]],
    caption: 'Stone, banners and warm torchlight introduce the journey.',
    destSide: 'top', destRoom: 'profile-hall'
  },
  {
    n: 2, title: 'The Archive Gallery',
    spawn: [5, 13],
    dest: [[18, 3], [19, 3]],
    arrival: [[5, 14], [6, 14]],
    walkable: [[3, 10, 8, 15], [7, 10, 19, 13], [16, 3, 20, 13]],
    blockedRects: [],
    props: [[3, 10], [4, 10], [10, 13], [11, 13], [16, 4], [20, 7]],
    caption: 'An L-shaped archive gallery lined with shelves and scrolls.',
    destSide: 'top', destRoom: 'analysis-chamber'
  },
  {
    n: 3, title: 'The Workshop Route',
    spawn: [5, 4],
    dest: [[18, 3], [19, 3]],
    arrival: [[5, 5], [6, 5]],
    walkable: [[3, 3, 7, 14], [3, 11, 20, 14], [16, 3, 20, 14]],
    blockedRects: [],
    props: [[3, 5], [20, 8], [7, 9], [16, 9]],
    caption: 'A U-shaped workshop route around a solid central core.',
    destSide: 'top', destRoom: 'router-quest'
  },
  {
    n: 4, title: 'The Monster Zigzag',
    spawn: [5, 14],
    dest: [[18, 2], [19, 2]],
    arrival: [[5, 15], [6, 15]],
    walkable: [[3, 11, 8, 15], [6, 10, 15, 12], [12, 6, 15, 12], [12, 4, 20, 7], [17, 2, 20, 7]],
    blockedRects: [],
    props: [[3, 12], [8, 15], [12, 7], [20, 6], [17, 4]],
    caption: 'A stepped zigzag with green banners, skulls, and the monster.',
    destSide: 'top', destRoom: 'reel-trap'
  },
  {
    n: 5, title: 'The Sanctuary Cross',
    spawn: [11, 14],
    dest: [[11, 3], [12, 3]],
    arrival: [[11, 15], [12, 15]],
    walkable: [[4, 7, 19, 10], [10, 3, 13, 14], [7, 11, 16, 15]],
    blockedRects: [],
    props: [[4, 7], [4, 9], [19, 7], [19, 9], [7, 12], [16, 12]],
    caption: 'A cross-shaped sanctuary with equipment alcoves and recovery supplies.',
    destSide: 'top', destRoom: 'plan-armory'
  },
  {
    n: 6, title: 'The Ring Archive',
    spawn: [6, 12],
    dest: [[11, 1], [12, 1]],
    arrival: [[6, 13], [7, 13]],
    walkable: [[4, 3, 19, 14], [9, 1, 14, 4]],
    blockedRects: [[8, 7, 15, 10]],
    props: [[4, 5], [19, 5], [5, 3], [18, 13], [17, 3], [10, 14]],
    caption: 'A ring-shaped archive around a solid island, with two approaches.',
    destSide: 'top', destRoom: 'infographic-vault'
  },
  {
    n: 7, title: 'The Final Passage',
    spawn: [11, 14],
    dest: [[11, 3], [12, 3]],
    arrival: [[11, 15], [12, 15]],
    walkable: [[5, 3, 18, 7], [10, 7, 13, 15], [7, 12, 16, 15]],
    blockedRects: [],
    props: [[5, 4], [18, 4], [7, 13], [16, 13], [9, 4], [14, 4]],
    caption: 'A processional passage leading to a broad final dais.',
    destSide: 'top', destRoom: 'exit'
  }
];

/* Build the collision grid for one hallway: true = walkable */
function buildGrid(h) {
  const grid = [];
  for (let r = 0; r < WORLD.ROWS; r++) grid.push(new Array(WORLD.COLS).fill(false));
  const open = (x1, y1, x2, y2, val) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
      if (y >= 0 && y < WORLD.ROWS && x >= 0 && x < WORLD.COLS) grid[y][x] = val;
    }
  };
  for (const [x1, y1, x2, y2] of h.walkable) open(x1, y1, x2, y2, true);
  for (const [x1, y1, x2, y2] of h.blockedRects) open(x1, y1, x2, y2, false);
  for (const [x, y] of h.props) if (grid[y] && y < WORLD.ROWS) grid[y][x] = false;
  return grid;
}

/* Wellness actions (master plan section 8) */
const WELLNESS = [
  'Turn off non-essential notifications (keep 3 apps)',
  'Set a 1-hour limit on FB Lite and Reels',
  'Complete one 90-minute study block with the phone elsewhere',
  'Verify two claims or AI answers with two reliable sources',
  'Spend one offline hour with friends or family',
  'Avoid screens for 30 minutes before bed',
  'Review Screen Time against Day 1'
];
