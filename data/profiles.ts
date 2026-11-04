/**
 * Fictional demo profiles for evidence-grounded matching.
 *
 * Every person, card, and outcome below is invented demo data for this
 * prototype. Names are fictional, experience is self-reported within the
 * fiction, and nothing here is verified or represents a real individual,
 * their availability, or their willingness to help.
 */

export type ProfileTheme = "debugging" | "first-users" | "learning-tools";

export interface ProfileCard {
  id: string;
  profileId: string;
  title: string;
  situation: string;
  constraints: string;
  attempts: string;
  outcome: string;
  /**
   * Reported state of this card's outcome, annotated by the demo-data
   * authors (not the model). Used for honest non-AI fallback labels.
   * Same value set as the match outcome enum; kept as a local union to
   * avoid a data/lib import cycle.
   */
  outcomeStatus: "resolved" | "partial" | "unresolved";
  /** Explicit gaps: what this card does not say. Never treat as known. */
  unknowns: string[];
}

export interface DemoProfile {
  id: string;
  /** Fictional display name. Resolved locally, never model-generated. */
  name: string;
  theme: ProfileTheme;
  cardIds: string[];
}

export const FICTIONAL_NOTICE =
  "Demo profiles are fictional and self-reported; nothing is verified.";

const card = (c: ProfileCard): ProfileCard => c;

const CARDS: ProfileCard[] = [
  card({
    id: "card-esp32-restart",
    profileId: "profile-maya",
    title: "ESP32 restarts when Wi-Fi starts",
    situation:
      "Fictional balcony plant monitor: an ESP32 reads a soil sensor and sends the value over Wi-Fi every ten minutes.",
    constraints: "Battery powered; small sealed enclosure; one weekend to fix.",
    attempts:
      "Tried a larger USB supply on the bench and added startup delays before connecting.",
    outcome:
      "Self-reported: fewer restarts on the bench supply, but the battery case was never retested.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether brownout, trapped heat, or a software watchdog causes the restarts.",
      "Whether the bench-supply improvement transfers to battery power.",
    ],
  }),
  card({
    id: "card-esp32-display",
    profileId: "profile-maya",
    title: "ESP32 nameplate with ghosting e-ink display",
    situation:
      "Fictional desk nameplate: an ESP32 drives a small e-ink panel that keeps faint images of previous text.",
    constraints: "Mains powered over USB; display refreshed a few times a day.",
    attempts:
      "Tried full refresh cycles and different waveform timings from the panel notes.",
    outcome:
      "Self-reported: full refreshes reduced ghosting, but slow updates remain annoying.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether the panel or the drive timing is at fault.",
      "No power or Wi-Fi problem was ever observed here.",
    ],
  }),
  card({
    id: "card-soil-drift",
    profileId: "profile-tomas",
    title: "Soil readings drifting at midday",
    situation:
      "Fictional raised-bed sensor whose moisture numbers climb every sunny afternoon without watering.",
    constraints: "Battery powered; sensor buried for the whole season.",
    attempts:
      "Tried shading the electronics box and logging the board temperature next to the readings.",
    outcome:
      "Self-reported: the drift tracked temperature, so readings are now temperature-flagged, not trusted blindly.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether a different probe would drift less.",
      "No restarts or connectivity failures were observed.",
    ],
  }),
  card({
    id: "card-balcony-dropout",
    profileId: "profile-priya",
    title: "Wireless planter readings stopping on hot afternoons",
    situation:
      "Fictional herb-planter gadget: wireless moisture updates stop arriving during hot afternoons and resume in the evening.",
    constraints: "Small solar panel; rented balcony; one weekend to work on it.",
    attempts:
      "Tried wiping the sensor clean and moving the panel into full sun, but the dropout still happens.",
    outcome:
      "Self-reported: no fix yet; the evening recovery pattern is consistent.",
    outcomeStatus: "unresolved",
    unknowns: [
      "Whether heat, power sag, or radio interference causes the dropout.",
      "The exact sensor model and radio behavior are not recorded.",
    ],
  }),
  card({
    id: "card-print-warp",
    profileId: "profile-jonas",
    title: "Large print corners lifting",
    situation:
      "Fictional hobbyist printing a wide storage-box lid that keeps curling up at two corners.",
    constraints: "Open-frame printer in a cool room; no enclosure allowed by the lease.",
    attempts:
      "Tried a brim, hotter bed for the first layers, and moving the printer away from the window.",
    outcome:
      "Self-reported: the brim plus a draft shield cut lifting roughly in half.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether a different plastic would behave better.",
      "Long-term adhesion over full prints is untested.",
    ],
  }),
  card({
    id: "card-quad-jello",
    profileId: "profile-jonas",
    title: "Shaky footage on a built quadcopter",
    situation:
      "Fictional first self-built quadcopter whose recorded video wobbles in fast flight.",
    constraints: "Tight student budget; only stock hardware, no gimbal.",
    attempts:
      "Tried balancing propellers and soft-mounting the camera with foam tape.",
    outcome:
      "Self-reported: noticeably smoother, though sharp turns still wobble.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether frame stiffness or tuning is the remaining cause.",
      "No electronics or power problem was investigated.",
    ],
  }),
  card({
    id: "card-soap-stall",
    profileId: "profile-amara",
    title: "Selling handmade soap at a market",
    situation:
      "Fictional soap maker booking a first weekend stall with forty bars and no mailing list.",
    constraints: "One table, cash and card reader, four hours of foot traffic.",
    attempts:
      "Tried free sniff samples, a three-for deal, and a paper signup sheet for repeat buyers.",
    outcome:
      "Self-reported: sold about half the stock; the signup sheet brought three repeat orders later.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether the same approach works without foot traffic.",
      "Costs and profit per bar are not recorded.",
    ],
  }),
  card({
    id: "card-tutor-flyers",
    profileId: "profile-elif",
    title: "Finding first tutoring pupils",
    situation:
      "Fictional student offering maths tutoring in a new neighborhood with no referrals.",
    constraints: "Paper flyers only; two free evenings a week.",
    attempts:
      "Tried library noticeboards and offering the first half hour free.",
    outcome:
      "Self-reported: two regular pupils within a month, both from the library board.",
    outcomeStatus: "resolved",
    unknowns: [
      "Whether online listings would work as well.",
      "Pricing beyond the free trial is not described.",
    ],
  }),
  card({
    id: "card-preset-pack",
    profileId: "profile-diego",
    title: "Selling photo presets online",
    situation:
      "Fictional hobby photographer packaging ten editing presets for other beginners.",
    constraints: "No audience yet; one small portfolio account; evenings only.",
    attempts:
      "Tried free before-and-after posts and asking three photographer friends for honest quotes.",
    outcome:
      "Self-reported: a handful of sales after a post showing the same photo with and without the preset.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether sales continue without new posts.",
      "Refund and support load are not described.",
    ],
  }),
  card({
    id: "card-news-sponsors",
    profileId: "profile-hana",
    title: "Sponsors for a tiny newsletter",
    situation:
      "Fictional street newsletter with two hundred readers looking for two small sponsors.",
    constraints: "Readers value independence; sponsors must be local shops.",
    attempts:
      "Tried a one-page reader profile and asking the two most-mentioned shops first.",
    outcome:
      "Self-reported: one bakery sponsored three issues after seeing the reader profile.",
    outcomeStatus: "partial",
    unknowns: [
      "Whether a second sponsor is reachable the same way.",
      "Reader numbers are self-reported and unverified.",
    ],
  }),
  card({
    id: "card-blender-first",
    profileId: "profile-sofie",
    title: "Learning Blender from scratch",
    situation:
      "Fictional illustrator learning 3D with thirty minutes each morning before work.",
    constraints: "Older laptop; short sessions; no paid courses.",
    attempts:
      "Tried following one beginner series end to end instead of jumping between tutorials.",
    outcome:
      "Self-reported: finished a first simple scene in six weeks and kept the habit.",
    outcomeStatus: "resolved",
    unknowns: [
      "Whether the pace suits someone without drawing experience.",
      "No comparison with other courses was made.",
    ],
  }),
  card({
    id: "card-guitar-daily",
    profileId: "profile-rasmus",
    title: "Guitar in twenty minutes a day",
    situation:
      "Fictional beginner relearning guitar after a ten-year break, in short evening sessions.",
    constraints: "Twenty minutes a day; thin apartment walls; no teacher.",
    attempts:
      "Tried practicing chord changes with a metronome app instead of full songs.",
    outcome:
      "Self-reported: clean changes on four chords after two months.",
    outcomeStatus: "partial",
    unknowns: [
      "How much the earlier experience helped is unclear.",
      "No teacher feedback was ever sought.",
    ],
  }),
  card({
    id: "card-sheet-budget",
    profileId: "profile-nadia",
    title: "Taming a budget with formulas",
    situation:
      "Fictional couple sorting shared spending with one spreadsheet and two paydays.",
    constraints: "One shared file; must stay simple enough for both to use.",
    attempts:
      "Tried one sheet per month plus a single summary row instead of a complex template.",
    outcome:
      "Self-reported: both partners actually opened it, which the fancy template never achieved.",
    outcomeStatus: "resolved",
    unknowns: [
      "Whether accuracy suffered from the simple layout.",
      "Long-term use beyond the first months is unknown.",
    ],
  }),
  card({
    id: "card-video-first-cut",
    profileId: "profile-leo",
    title: "First short film from trip footage",
    situation:
      "Fictional beginner cutting family trip footage into a short film, learning video editing from zero.",
    constraints: "About thirty minutes a day; five-year-old laptop.",
    attempts:
      "Tried three tutorial openings, then picked one series and cut one short scene per week.",
    outcome:
      "Self-reported: a watchable five-minute film after two months; the laptop handled short timelines.",
    outcomeStatus: "resolved",
    unknowns: [
      "Whether the laptop copes with longer projects.",
      "Only one editing app was ever tried.",
    ],
  }),
];

export const PROFILES: DemoProfile[] = [
  { id: "profile-maya", name: "Maya", theme: "debugging", cardIds: ["card-esp32-restart", "card-esp32-display"] },
  { id: "profile-tomas", name: "Tomas", theme: "debugging", cardIds: ["card-soil-drift"] },
  { id: "profile-priya", name: "Priya", theme: "debugging", cardIds: ["card-balcony-dropout"] },
  { id: "profile-jonas", name: "Jonas", theme: "debugging", cardIds: ["card-print-warp", "card-quad-jello"] },
  { id: "profile-amara", name: "Amara", theme: "first-users", cardIds: ["card-soap-stall"] },
  { id: "profile-elif", name: "Elif", theme: "first-users", cardIds: ["card-tutor-flyers"] },
  { id: "profile-diego", name: "Diego", theme: "first-users", cardIds: ["card-preset-pack"] },
  { id: "profile-hana", name: "Hana", theme: "first-users", cardIds: ["card-news-sponsors"] },
  { id: "profile-sofie", name: "Sofie", theme: "learning-tools", cardIds: ["card-blender-first"] },
  { id: "profile-rasmus", name: "Rasmus", theme: "learning-tools", cardIds: ["card-guitar-daily"] },
  { id: "profile-nadia", name: "Nadia", theme: "learning-tools", cardIds: ["card-sheet-budget"] },
  { id: "profile-leo", name: "Leo", theme: "learning-tools", cardIds: ["card-video-first-cut"] },
];

export const PROFILE_BY_ID: Record<string, DemoProfile> = Object.fromEntries(
  PROFILES.map((p) => [p.id, p]),
);

export const CARD_BY_ID: Record<string, ProfileCard> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);
