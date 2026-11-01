export type ExperienceGroup = "workshop" | "market" | "learning";

export interface Experience {
  id: string;
  title: string;
  group: ExperienceGroup;
  /** Fixed position in the 3D scene; deterministic, never randomized. */
  position: [number, number, number];
  situation: string;
  constraints: string;
  attempted: string;
  /** Self-reported by the fictional contributor; not independently verified. */
  outcome: string;
  tools: string;
  differences: string;
}

export interface ExperienceLink {
  from: string;
  to: string;
  /** The explicit shared attribute this connection is drawn for. */
  shared: string;
}

export const GROUPS: Record<
  ExperienceGroup,
  { label: string; blurb: string }
> = {
  workshop: {
    label: "Workshop prototypes",
    blurb: "Small physical builds debugged at home.",
  },
  market: {
    label: "First customers",
    blurb: "Tiny offers finding their first buyers.",
  },
  learning: {
    label: "Learning a tool",
    blurb: "New skills practiced in short sessions.",
  },
};

export const EXPERIENCES: Experience[] = [
  {
    id: "esp32-restart",
    title: "ESP32 restarts when Wi-Fi starts",
    group: "workshop",
    position: [-2.6, 0.9, 0.4],
    situation:
      "A fictional balcony plant monitor: an ESP32 reads a soil sensor and sends the value over Wi-Fi every ten minutes.",
    constraints: "Battery powered; small sealed enclosure; one weekend to fix.",
    attempted:
      "Tried a larger USB supply on the bench and added startup delays before connecting.",
    outcome:
      "Self-reported: fewer restarts on the bench supply, but the battery case was never retested.",
    tools: "ESP32 dev board, capacitive soil sensor, small Li-ion pack.",
    differences:
      "Unknown whether the cause is brownout, the enclosure trapping heat, or a software watchdog. A matching symptom does not prove a matching cause.",
  },
  {
    id: "print-warp",
    title: "Large print corners lifting",
    group: "workshop",
    position: [-1.4, -0.4, 1.2],
    situation:
      "A fictional hobbyist printing a wide storage-box lid that keeps curling up at two corners.",
    constraints: "Open-frame printer in a cool room; no enclosure allowed by the lease.",
    attempted:
      "Tried a brim, hotter bed for the first layers, and moving the printer away from the window.",
    outcome:
      "Self-reported: the brim plus a draft shield cut lifting roughly in half.",
    tools: "Open-frame printer, PLA, glue stick, cardboard draft shield.",
    differences:
      "Different plastic, room, and printer than any other case here. Results may not transfer.",
  },
  {
    id: "quad-jello",
    title: "Shaky footage on a built quadcopter",
    group: "workshop",
    position: [-2.4, -1.0, -1.0],
    situation:
      "A fictional first self-built quadcopter whose recorded video wobbles in fast flight.",
    constraints: "Tight student budget; only stock hardware, no gimbal.",
    attempted:
      "Tried balancing propellers and soft-mounting the camera with foam tape.",
    outcome:
      "Self-reported: noticeably smoother, though sharp turns still wobble.",
    tools: "5-inch frame, stock motors, foam mounting tape.",
    differences:
      "Frame stiffness and tuning are unknown; vibration sources differ per build.",
  },
  {
    id: "soil-drift",
    title: "Soil readings drifting at midday",
    group: "workshop",
    position: [-0.9, 1.1, -0.8],
    situation:
      "A fictional raised-bed sensor whose moisture numbers climb every sunny afternoon without watering.",
    constraints: "Battery powered; sensor buried for the whole season.",
    attempted:
      "Tried shading the electronics box and logging the board temperature next to the readings.",
    outcome:
      "Self-reported: the drift tracked temperature, so readings are now temperature-flagged, not trusted blindly.",
    tools: "Capacitive soil probe, shaded project box, temperature log.",
    differences:
      "A reading problem, not a restart problem; the fix was measurement hygiene, not power.",
  },
  {
    id: "soap-stall",
    title: "Selling handmade soap at a market",
    group: "market",
    position: [1.6, 0.8, 0.9],
    situation:
      "A fictional soap maker booking a first weekend stall with forty bars and no mailing list.",
    constraints: "One table, cash and card reader, four hours of foot traffic.",
    attempted:
      "Tried free sniff samples, a three-for deal, and a paper signup sheet for repeat buyers.",
    outcome:
      "Self-reported: sold about half the stock; the signup sheet brought three repeat orders later.",
    tools: "Card reader, sample slices, paper signup sheet.",
    differences:
      "Local foot traffic and weather drove the day; online sellers face different discovery.",
  },
  {
    id: "preset-pack",
    title: "Selling photo presets online",
    group: "market",
    position: [2.7, -0.3, 0.2],
    situation:
      "A fictional hobby photographer packaging ten editing presets for other beginners.",
    constraints: "No audience yet; one small portfolio account; evenings only.",
    attempted:
      "Tried free before-and-after posts and asking three photographer friends for honest quotes.",
    outcome:
      "Self-reported: a handful of sales after a post showing the same photo with and without the preset.",
    tools: "Editing app, small portfolio account, discount codes.",
    differences:
      "Digital goods with zero restocking; pricing and refund pressure differ from physical goods.",
  },
  {
    id: "tutor-flyers",
    title: "Finding first tutoring pupils",
    group: "market",
    position: [1.4, -1.1, -1.1],
    situation:
      "A fictional student offering maths tutoring in a new neighborhood with no referrals.",
    constraints: "Paper flyers only; two free evenings a week.",
    attempted:
      "Tried library noticeboards and offering the first half hour free.",
    outcome:
      "Self-reported: two regular pupils within a month, both from the library board.",
    tools: "Printed flyers, library noticeboards, free trial session.",
    differences:
      "Trust and safety matter far more here than for selling objects; parents decide, not the pupil.",
  },
  {
    id: "news-sponsors",
    title: "Sponsors for a tiny newsletter",
    group: "market",
    position: [2.6, 1.0, -0.9],
    situation:
      "A fictional street newsletter with two hundred readers looking for two small sponsors.",
    constraints: "Readers value independence; sponsors must be local shops.",
    attempted:
      "Tried a one-page reader profile and asking the two most-mentioned shops first.",
    outcome:
      "Self-reported: one bakery sponsored three issues after seeing the reader profile.",
    tools: "One-page reader profile, in-person visits.",
    differences:
      "Selling attention, not a product; the asset is reader trust, which is easy to spend.",
  },
  {
    id: "blender-first",
    title: "Learning Blender from scratch",
    group: "learning",
    position: [-0.2, 0.6, 1.6],
    situation:
      "A fictional illustrator learning 3D with thirty minutes each morning before work.",
    constraints: "Older laptop; short sessions; no paid courses.",
    attempted:
      "Tried following one beginner series end to end instead of jumping between tutorials.",
    outcome:
      "Self-reported: finished a first simple scene in six weeks and kept the habit.",
    tools: "Free tutorial series, default cube, morning timer.",
    differences:
      "Progress is slow by design; not comparable to full-time study sprints.",
  },
  {
    id: "sheet-budget",
    title: "Taming a budget with formulas",
    group: "learning",
    position: [0.4, -0.9, 1.4],
    situation:
      "A fictional couple sorting shared spending with one spreadsheet and two paydays.",
    constraints: "One shared file; must stay simple enough for both to use.",
    attempted:
      "Tried one sheet per month plus a single summary row instead of a complex template.",
    outcome:
      "Self-reported: both partners actually opened it, which the fancy template never achieved.",
    tools: "Spreadsheet app, one summary row, monthly sheets.",
    differences:
      "The win was adoption, not accuracy; stricter tracking was deliberately skipped.",
  },
  {
    id: "guitar-daily",
    title: "Guitar in twenty minutes a day",
    group: "learning",
    position: [-0.4, 0.1, -1.7],
    situation:
      "A fictional beginner relearning guitar after a ten-year break, in short evening sessions.",
    constraints: "Twenty minutes a day; thin apartment walls; no teacher.",
    attempted:
      "Tried practicing chord changes with a metronome app instead of full songs.",
    outcome:
      "Self-reported: clean changes on four chords after two months.",
    tools: "Second-hand guitar, metronome app, practice log.",
    differences:
      "Prior experience helped silently; a true beginner would likely progress slower.",
  },
  {
    id: "bread-schedule",
    title: "Sourdough around a workday",
    group: "learning",
    position: [0.9, 0.5, -1.6],
    situation:
      "A fictional office worker fitting bread baking around nine-to-five hours.",
    constraints: "No weekday attention between eight and six; cool kitchen.",
    attempted:
      "Tried an overnight fridge routine with weekend-only baking.",
    outcome:
      "Self-reported: edible loaves most weekends; weekday baking abandoned.",
    tools: "Fridge, timer, weekend schedule.",
    differences:
      "Kitchen temperature and flour vary; the schedule matters more than the recipe tweaks.",
  },
];

export const LINKS: ExperienceLink[] = [
  { from: "esp32-restart", to: "soil-drift", shared: "Battery-powered outdoor sensor builds" },
  { from: "esp32-restart", to: "quad-jello", shared: "Small builds where power stability under load is an open question" },
  { from: "esp32-restart", to: "print-warp", shared: "Home-workspace prototypes with heat and environment unknowns" },
  { from: "print-warp", to: "quad-jello", shared: "Vibration and mechanical fit suspected before electronics" },
  { from: "soil-drift", to: "bread-schedule", shared: "Environment temperature quietly skewing the results" },
  { from: "soap-stall", to: "tutor-flyers", shared: "First buyers found through local, in-person notice" },
  { from: "soap-stall", to: "news-sponsors", shared: "Selling to neighborhood shops face to face" },
  { from: "preset-pack", to: "news-sponsors", shared: "A one-page proof shown before asking for money" },
  { from: "preset-pack", to: "sheet-budget", shared: "A simple artifact beating a fancy one" },
  { from: "tutor-flyers", to: "guitar-daily", shared: "Progress tracked in a plain visible log" },
  { from: "blender-first", to: "guitar-daily", shared: "Short daily sessions instead of occasional long ones" },
  { from: "blender-first", to: "sheet-budget", shared: "One simple routine finished end to end" },
  { from: "sheet-budget", to: "bread-schedule", shared: "A routine built around fixed weekday hours" },
  { from: "soap-stall", to: "preset-pack", shared: "Before-and-after proof shown to hesitant buyers" },
];

export const EXPERIENCE_BY_ID: Record<string, Experience> = Object.fromEntries(
  EXPERIENCES.map((e) => [e.id, e]),
);

export function relatedTo(id: string): { experience: Experience; shared: string }[] {
  const out: { experience: Experience; shared: string }[] = [];
  for (const link of LINKS) {
    if (link.from === id && EXPERIENCE_BY_ID[link.to]) {
      out.push({ experience: EXPERIENCE_BY_ID[link.to], shared: link.shared });
    } else if (link.to === id && EXPERIENCE_BY_ID[link.from]) {
      out.push({ experience: EXPERIENCE_BY_ID[link.from], shared: link.shared });
    }
  }
  return out;
}
