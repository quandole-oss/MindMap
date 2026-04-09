import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import * as schema from "./schema";
import { sql } from "drizzle-orm";

const {
  users,
  classes,
  classEnrollments,
  questions,
  concepts,
  conceptEdges,
  conceptQuestions,
  diagnosticSessions,
} = schema;

// ─── helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── data tables ─────────────────────────────────────────────────────────────

const STUDENT_NAMES = [
  "Alex Chen",
  "Jordan Williams",
  "Priya Patel",
  "Sam Okafor",
  "Mia Thompson",
  "Liam Hernandez",
  "Zara Ahmed",
  "Tyler Brooks",
  "Ava Kowalski",
  "Noah Kim",
  "Isabella Moreau",
  "Ethan Johansson",
  "Amara Osei",
  "Lucas Nakamura",
  "Sofia Reyes",
  "Owen McCarthy",
  "Fatima Al-Hassan",
  "Caleb Nguyen",
  "Ruby Blackwood",
  "Daniel Espinoza",
  "Maya Sato",
  "Finn O'Brien",
];

// ─── question/concept data for 30-day student ────────────────────────────────

const QUESTIONS_30DAY: Array<{
  text: string;
  aiResponse: string;
  domain: string;
  routingMode: "enrich" | "diagnose";
  routingMisconceptionId?: string;
  conceptNames: string[];
  daysBack: number;
}> = [
  {
    text: "Why is the sky blue?",
    aiResponse:
      "The sky appears blue because of a phenomenon called Rayleigh scattering. When sunlight enters Earth's atmosphere, it collides with gas molecules. Blue light has a shorter wavelength and scatters more than red or yellow light, spreading across the entire sky. That's why you see blue in every direction when you look up.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["light scattering", "wavelength", "atmosphere"],
    daysBack: 30,
  },
  {
    text: "How do birds know which direction to migrate?",
    aiResponse:
      "Birds use multiple navigation systems simultaneously — they detect Earth's magnetic field through iron-rich cells in their beaks, read star patterns at night, and use the position of the Sun during the day. Some species also follow coastlines and mountain ranges as visual landmarks. This multi-system approach makes migration robust even in cloudy weather.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["migration", "magnetoreception", "navigation"],
    daysBack: 29,
  },
  {
    text: "How do plants make food from sunlight?",
    aiResponse:
      "Plants perform photosynthesis — they capture light energy using chlorophyll in their leaves and use it to convert carbon dioxide from the air and water from the soil into glucose sugar. Oxygen is released as a byproduct. The equation is: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂.",
    domain: "biology",
    routingMode: "diagnose",
    routingMisconceptionId: "bio-001",
    conceptNames: ["photosynthesis", "chlorophyll", "glucose"],
    daysBack: 28,
  },
  {
    text: "Why do we have leap years?",
    aiResponse:
      "A solar year (Earth's full orbit around the Sun) is approximately 365.2422 days — not exactly 365. Without correction, our calendar would drift, and seasons would shift. By adding an extra day every four years (with century-year exceptions), we keep the calendar synchronized with Earth's actual position.",
    domain: "math",
    routingMode: "enrich",
    conceptNames: ["calendar systems", "orbital period", "time measurement"],
    daysBack: 27,
  },
  {
    text: "Why did dinosaurs go extinct?",
    aiResponse:
      "The leading explanation is the Chicxulub asteroid impact 66 million years ago, which released energy equivalent to billions of nuclear bombs, ignited global wildfires, and triggered a 'nuclear winter' that blocked sunlight for years. This collapsed food chains, killing about 75% of all species. Volcanic activity from the Deccan Traps in India may have already stressed ecosystems before impact.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["mass extinction", "asteroid impact", "food chains"],
    daysBack: 26,
  },
  {
    text: "How do magnets work?",
    aiResponse:
      "Magnetism arises from the quantum spin of electrons. In most materials, electrons pair up with opposite spins, canceling out. In ferromagnetic materials like iron, many electrons align in the same direction, creating magnetic domains. When domains align, the object becomes a magnet. At the atomic level, magnetism and electricity are aspects of the same fundamental force: electromagnetism.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["magnetism", "electron spin", "magnetic domains", "electromagnetism"],
    daysBack: 25,
  },
  {
    text: "Why does the Moon have phases?",
    aiResponse:
      "The Moon doesn't produce its own light — it reflects sunlight. As the Moon orbits Earth over about 29.5 days, we see different portions of its sunlit half. When the Moon is between Earth and Sun (new moon), we see none of its lit side. When Earth is between Sun and Moon (full moon), we see the entire lit face.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["lunar phases", "reflection", "orbital motion"],
    daysBack: 24,
  },
  {
    text: "How does the human immune system fight viruses?",
    aiResponse:
      "When a virus enters your body, innate immune cells like macrophages immediately attack it and release chemical signals (cytokines) calling for backup. Dendritic cells bring virus fragments to lymph nodes where B-cells create antibodies specific to that virus, and T-cells learn to destroy infected cells. Memory cells remain after the infection, enabling faster responses if the virus returns.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["immune response", "antibodies", "T-cells", "memory cells"],
    daysBack: 23,
  },
  {
    text: "How do black holes form?",
    aiResponse:
      "Black holes form when massive stars (at least 20 times the Sun's mass) exhaust their nuclear fuel and collapse under their own gravity. The core collapses to a point of infinite density (singularity) while the outer layers explode as a supernova. The resulting gravity is so intense that not even light can escape beyond the event horizon.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["black holes", "gravitational collapse", "event horizon", "supernovae"],
    daysBack: 22,
  },
  {
    text: "Why does salt melt ice?",
    aiResponse:
      "Salt lowers the freezing point of water through a process called freezing point depression. When dissolved in water, salt ions disrupt the formation of ice crystals, requiring a lower temperature to freeze. This is why roads are salted in winter — the brine formed by salt and meltwater stays liquid at temperatures where pure water would freeze.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["freezing point depression", "solutions", "phase changes"],
    daysBack: 21,
  },
  {
    text: "How does DNA store genetic information?",
    aiResponse:
      "DNA is a double helix made of four bases: adenine (A), thymine (T), guanine (G), and cytosine (C). The sequence of these bases encodes instructions. Groups of three bases (codons) specify which amino acid to add when building proteins. A human genome contains about 3 billion base pairs encoding roughly 20,000 protein-coding genes.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["DNA structure", "genetic code", "base pairs", "proteins"],
    daysBack: 20,
  },
  {
    text: "Why do heavier objects fall at the same speed as lighter ones?",
    aiResponse:
      "Galileo demonstrated that all objects fall at the same rate in the absence of air resistance. Gravity accelerates every object equally (9.8 m/s² on Earth's surface) regardless of mass, because gravitational force and inertia are proportional to mass in the same way — they cancel out. A heavier object experiences more gravitational force, but also has more inertia to overcome.",
    domain: "physics",
    routingMode: "diagnose",
    routingMisconceptionId: "phys-001",
    conceptNames: ["gravity", "free fall", "inertia"],
    daysBack: 19,
  },
  {
    text: "How do earthquakes happen?",
    aiResponse:
      "Earth's outer shell is divided into tectonic plates that move slowly on the semi-fluid mantle below. Where plates meet, they can collide, pull apart, or slide past each other. When plates lock together, stress builds up over decades or centuries. When the rock finally breaks and slips, elastic energy releases suddenly as seismic waves — an earthquake.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["tectonic plates", "seismic waves", "fault lines"],
    daysBack: 18,
  },
  {
    text: "Why do we dream?",
    aiResponse:
      "Scientists aren't fully certain, but leading theories suggest dreams serve memory consolidation — the brain replays and strengthens neural pathways formed during the day. REM sleep (when most dreams occur) appears critical for emotional processing and creative problem-solving. Some researchers think dreams are a side effect of the brain running simulations to prepare for future threats.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["REM sleep", "memory consolidation", "neuroscience"],
    daysBack: 17,
  },
  {
    text: "How does electricity flow through wires?",
    aiResponse:
      "Electric current is the flow of electrons through a conductor. Metal wires have many free electrons not bound to specific atoms. When a voltage (electric potential difference) is applied, these electrons drift toward the positive terminal. Interestingly, the electrons drift slowly (millimeters per second) but electrical signals propagate nearly at the speed of light through the electromagnetic field.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["electric current", "electrons", "conductors", "voltage"],
    daysBack: 16,
  },
  {
    text: "Why is the ocean salty?",
    aiResponse:
      "Ocean salinity comes from two main sources: rivers carrying dissolved minerals from rocks over millions of years, and hydrothermal vents on the ocean floor releasing mineral-rich water. Water evaporates from the ocean leaving salts behind, concentrating them over geological time. The predominant salt is sodium chloride (common table salt), but the ocean contains dozens of dissolved minerals.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["ocean chemistry", "evaporation", "mineral dissolution"],
    daysBack: 15,
  },
  {
    text: "How do vaccines work?",
    aiResponse:
      "Vaccines introduce your immune system to a harmless version of a pathogen — either weakened, killed, or just a piece of it (like a protein). Your immune system mounts a response and, crucially, creates memory B-cells and T-cells. If you later encounter the real pathogen, your immune system recognizes it immediately and neutralizes it before you get sick.",
    domain: "biology",
    routingMode: "diagnose",
    routingMisconceptionId: "bio-009",
    conceptNames: ["vaccines", "immunity", "pathogens"],
    daysBack: 14,
  },
  {
    text: "What causes thunder and lightning?",
    aiResponse:
      "Lightning forms when charge separation builds up in storm clouds — ice crystals near the top carry positive charge, while heavier graupel particles near the bottom carry negative charge. When the field becomes strong enough, a massive spark (lightning bolt) discharges between cloud and ground (or within the cloud). Thunder is the sonic shockwave from the superheated air around the bolt expanding explosively.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["lightning", "electrical charge", "thunderstorms"],
    daysBack: 13,
  },
  {
    text: "How do computers store information?",
    aiResponse:
      "Modern computers store data as binary (1s and 0s) represented by transistor states (on/off). Billions of transistors on a chip form logic gates that process these bits. For long-term storage, hard drives use magnetized regions on spinning platters, while SSDs use floating-gate transistors that trap electrons. All text, images, and video are ultimately encoded as sequences of bits.",
    domain: "math",
    routingMode: "enrich",
    conceptNames: ["binary systems", "transistors", "data storage"],
    daysBack: 12,
  },
  {
    text: "Why do some animals hibernate?",
    aiResponse:
      "Hibernation is an energy-conservation strategy for animals in environments where winter brings food scarcity and cold temperatures. True hibernators (like ground squirrels) drop their body temperature near freezing, slow heart rate to a few beats per minute, and stop breathing regularly — surviving on stored fat for months. Bears enter a lighter torpor rather than true hibernation.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["hibernation", "metabolic rate", "energy conservation"],
    daysBack: 11,
  },
  {
    text: "How do we measure the distance to stars?",
    aiResponse:
      "For nearby stars (up to ~1000 light-years), astronomers use stellar parallax — measuring the apparent shift in a star's position as Earth orbits the Sun. For more distant stars, they use 'standard candles' like Cepheid variable stars, whose intrinsic brightness is known from their pulsation period. The distance follows from comparing intrinsic and apparent brightness.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["stellar parallax", "standard candles", "light-years"],
    daysBack: 10,
  },
  {
    text: "Why do some people have allergies?",
    aiResponse:
      "Allergies are an overactive immune response to harmless substances (allergens) like pollen or peanut proteins. In sensitive individuals, initial exposure sensitizes the immune system — IgE antibodies bind to mast cells. On re-exposure, the allergen cross-links these antibodies, triggering mast cells to release histamine and other mediators that cause the classic allergy symptoms.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["allergic response", "IgE antibodies", "histamine", "mast cells"],
    daysBack: 9,
  },
  {
    text: "What is the Pythagorean theorem and why does it work?",
    aiResponse:
      "The Pythagorean theorem states that in a right triangle, a² + b² = c² (where c is the hypotenuse). It works because the area of the square built on the hypotenuse equals the combined area of squares on the other two sides — demonstrable by rearranging the triangles. It holds in flat (Euclidean) space but breaks down on curved surfaces like Earth's surface.",
    domain: "math",
    routingMode: "enrich",
    conceptNames: ["Pythagorean theorem", "right triangles", "Euclidean geometry"],
    daysBack: 8,
  },
  {
    text: "How do planes stay in the air?",
    aiResponse:
      "Lift is generated primarily by the wing's angle of attack — the wing pushes air downward, and Newton's third law pushes the wing up. The Bernoulli effect also contributes: the curved upper wing surface forces air to travel farther, increasing its speed and reducing pressure above the wing. Both effects work together to generate lift that exceeds the plane's weight.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["aerodynamic lift", "Bernoulli effect", "Newton's third law"],
    daysBack: 7,
  },
  {
    text: "Why does the Moon cause tides?",
    aiResponse:
      "The Moon's gravity pulls on Earth's oceans, but its pull is stronger on the near side than the far side (tidal gradient). This stretches Earth's oceans into an ellipsoid with bulges on both the Moon-facing side and the opposite side. As Earth rotates, different coastal areas move through these bulges — experiencing two high tides and two low tides each day.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["tidal forces", "gravitational gradient", "ocean dynamics"],
    daysBack: 6,
  },
  {
    text: "How does the brain store memories?",
    aiResponse:
      "Memory storage involves strengthening synaptic connections between neurons through a process called long-term potentiation (LTP). When neurons fire together repeatedly, the synaptic connection between them grows stronger (Hebb's rule: 'neurons that fire together wire together'). Different memory types use different brain regions: the hippocampus for episodic memories, the cerebellum for motor memories, and the amygdala for emotional memories.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["synaptic plasticity", "long-term potentiation", "hippocampus"],
    daysBack: 5,
  },
  {
    text: "What is entropy and why does it always increase?",
    aiResponse:
      "Entropy measures the number of ways a system can be arranged at the microscopic level. There are vastly more disordered arrangements than ordered ones — so random processes statistically move toward disorder. The Second Law of Thermodynamics states that the total entropy of an isolated system tends to increase. It's not a fundamental force but a statistical inevitability.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["entropy", "thermodynamics", "statistical mechanics"],
    daysBack: 4,
  },
  {
    text: "Why do seasons change?",
    aiResponse:
      "Seasons are caused by Earth's axial tilt (about 23.5°), not by Earth's distance from the Sun. When the Northern Hemisphere tilts toward the Sun, sunlight strikes more directly and days are longer — producing summer. Six months later, it tilts away, producing winter. Interestingly, Earth is actually closer to the Sun during Northern Hemisphere winter.",
    domain: "physics",
    routingMode: "diagnose",
    routingMisconceptionId: "phys-005",
    conceptNames: ["axial tilt", "seasons", "solar radiation angle"],
    daysBack: 3,
  },
  {
    text: "How do antibiotics work?",
    aiResponse:
      "Antibiotics target structures and processes found in bacteria but not in human cells. For example, penicillin-class antibiotics block bacterial cell wall synthesis — bacteria burst from osmotic pressure without a wall. Other antibiotics disrupt bacterial ribosomes (preventing protein synthesis) or DNA replication. Since human cells lack cell walls and have different ribosomes, these drugs are selectively toxic to bacteria.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["antibiotics", "cell wall synthesis", "bacterial ribosomes"],
    daysBack: 2,
  },
  {
    text: "How do plants grow toward light?",
    aiResponse:
      "Phototropism (growing toward light) is controlled by the hormone auxin. When light hits a plant from one side, auxin migrates to the shaded side, where it causes cells to elongate more than cells on the lit side. This differential growth bends the plant toward the light source. This is why plants on a windowsill lean toward the glass.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["phototropism", "auxin", "plant hormones"],
    daysBack: 1,
  },
];

// ─── questions for 60-day student (additional 30, days 31–60) ────────────────

const QUESTIONS_60DAY_EXTRA: Array<{
  text: string;
  aiResponse: string;
  domain: string;
  routingMode: "enrich" | "diagnose";
  routingMisconceptionId?: string;
  conceptNames: string[];
  daysBack: number;
}> = [
  {
    text: "How does sonar work underwater?",
    aiResponse:
      "Sonar emits pulses of sound and listens for echoes. The time for an echo to return reveals distance (distance = speed of sound in water × time / 2). Sound travels about 1,480 m/s in seawater — much faster than in air — making sonar effective for submarine navigation and fish-finding. Dolphins and whales evolved biological sonar (echolocation) independently.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["sonar", "echolocation", "sound speed in water"],
    daysBack: 60,
  },
  {
    text: "Why do humans have an appendix?",
    aiResponse:
      "The appendix was long considered vestigial, but research suggests it serves as a 'safe house' for beneficial gut bacteria. After GI illness flushes the intestines, bacteria from the appendix can help repopulate the gut. It also contains immune tissue (lymphoid tissue) involved in gut immunity. Its absence of obvious function likely reflects reduced selective pressure rather than complete uselessness.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["appendix", "gut microbiome", "vestigial organs"],
    daysBack: 59,
  },
  {
    text: "What is the Standard Model of particle physics?",
    aiResponse:
      "The Standard Model describes the fundamental particles and forces that make up the universe. It includes quarks (building blocks of protons and neutrons), leptons (like electrons and neutrinos), and gauge bosons (force carriers: photons for electromagnetism, W/Z bosons for the weak force, gluons for the strong force). The Higgs boson gives particles mass. Gravity is not yet unified with this model.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["Standard Model", "quarks", "leptons", "bosons"],
    daysBack: 58,
  },
  {
    text: "How do trees communicate with each other?",
    aiResponse:
      "Trees in forests communicate through mycorrhizal fungal networks (the 'wood wide web') — underground hyphal threads connecting root systems. Trees can share carbon, water, and nutrients through these networks. They also release volatile organic compounds (VOCs) into the air that neighboring trees detect, triggering defensive responses. Older 'mother trees' have been shown to preferentially support younger trees of the same species.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["mycorrhizal networks", "tree communication", "VOCs"],
    daysBack: 57,
  },
  {
    text: "Why does multiplication sometimes make numbers smaller?",
    aiResponse:
      "Multiplication by a fraction or decimal less than 1 makes the result smaller because you're scaling by a factor below 1. For example, 10 × 0.5 = 5. Multiplication means 'scaled by' — scaling by 0.3 gives you 30% of the original. Our intuition is built from whole-number experience where multiplying always increases value, but fractions break that rule.",
    domain: "math",
    routingMode: "diagnose",
    routingMisconceptionId: "math-001",
    conceptNames: ["fraction multiplication", "scaling", "number sense"],
    daysBack: 56,
  },
  {
    text: "How does CRISPR gene editing work?",
    aiResponse:
      "CRISPR-Cas9 uses a guide RNA to direct the Cas9 protein to a specific DNA sequence. Cas9 acts as molecular scissors, cutting both strands of DNA at that location. The cell's repair mechanisms then either disrupt the gene (cutting it off) or, if a template is provided, incorporate new genetic information. This allows scientists to precisely edit genes in living organisms.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["CRISPR", "gene editing", "guide RNA", "DNA repair"],
    daysBack: 55,
  },
  {
    text: "What is quantum entanglement?",
    aiResponse:
      "Quantum entanglement occurs when two particles interact such that their quantum states are correlated, regardless of distance. Measuring one particle's state instantly determines the correlated property of its partner — no matter how far apart they are. Crucially, this cannot be used to transmit information faster than light because the measurement outcomes are random; only correlation is instantaneous.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["quantum entanglement", "quantum mechanics", "non-locality"],
    daysBack: 54,
  },
  {
    text: "How does the water cycle work?",
    aiResponse:
      "The water cycle (hydrological cycle) circulates water through evaporation from oceans and lakes, condensation into clouds, precipitation as rain or snow, surface runoff into rivers, infiltration into groundwater, and transpiration from plants. Solar energy drives evaporation; gravity drives precipitation and runoff. The cycle moves about 505,000 km³ of water per year.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["water cycle", "evaporation", "transpiration", "precipitation"],
    daysBack: 53,
  },
  {
    text: "Why is pi irrational?",
    aiResponse:
      "Pi (π) is the ratio of a circle's circumference to its diameter. It is irrational — its decimal expansion never repeats or terminates — because it cannot be expressed as a fraction of two integers. Johann Lambert proved this in 1768. The proof shows that if π were rational, the tangent function would have to produce rational outputs for rational inputs in a way that leads to contradiction.",
    domain: "math",
    routingMode: "enrich",
    conceptNames: ["pi", "irrational numbers", "circumference"],
    daysBack: 52,
  },
  {
    text: "How does the greenhouse effect work?",
    aiResponse:
      "The Sun emits mostly short-wave radiation that passes easily through the atmosphere to warm Earth's surface. Earth re-emits this energy as longer-wave infrared radiation (heat). Greenhouse gases like CO₂, methane, and water vapor absorb this outgoing infrared and re-radiate it in all directions — including back toward Earth. This 'trapping' of heat warms the planet beyond what solar input alone would produce.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["greenhouse effect", "infrared radiation", "atmospheric gases"],
    daysBack: 51,
  },
  {
    text: "What causes cancer?",
    aiResponse:
      "Cancer develops when mutations accumulate in a cell's DNA, disrupting the normal controls on cell division. Oncogenes (growth-promoting genes) can become overactive; tumor suppressor genes (like p53) can be inactivated. Multiple mutations are usually required — typically 5-10 key genetic changes. Causes include replication errors, carcinogens (chemicals, UV radiation), viruses, and inherited mutations.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["cancer biology", "mutations", "oncogenes", "tumor suppressors"],
    daysBack: 50,
  },
  {
    text: "How does a nuclear reactor work?",
    aiResponse:
      "Nuclear reactors generate heat through controlled nuclear fission — splitting heavy atoms (usually uranium-235 or plutonium-239). When a neutron strikes a nucleus, it splits, releasing 2-3 more neutrons and enormous energy. A moderator (usually water) slows neutrons to sustain the chain reaction. Control rods absorb neutrons to regulate the reaction rate. The heat produces steam to drive turbines.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["nuclear fission", "chain reaction", "neutron moderation"],
    daysBack: 49,
  },
  {
    text: "Why does the Earth have a magnetic field?",
    aiResponse:
      "Earth's magnetic field is generated by the geodynamo — convective motion of liquid iron in the outer core, driven by heat from the inner core and compositional differences. Moving electrical charges (the flowing iron) generate a magnetic field through electromagnetic induction. The field protects Earth from the solar wind, which would otherwise strip away the atmosphere.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["geodynamo", "magnetic field", "outer core", "solar wind"],
    daysBack: 48,
  },
  {
    text: "How do bees make honey?",
    aiResponse:
      "Bees collect nectar from flowers and carry it in a honey stomach. Back at the hive, worker bees pass it mouth-to-mouth, breaking down complex sugars with enzymes (particularly invertase). The nectar is spread in honeycomb cells and fanned with wings to evaporate most of its water (from ~80% to ~18% water content). The resulting high-sugar, low-water solution resists spoilage — this is honey.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["honey production", "nectar processing", "enzymatic hydrolysis"],
    daysBack: 47,
  },
  {
    text: "What is Bayes' theorem and why is it important?",
    aiResponse:
      "Bayes' theorem describes how to update a probability estimate in light of new evidence: P(A|B) = P(B|A) × P(A) / P(B). It's foundational because it formalizes rational belief updating — starting with a prior probability, you update to a posterior probability based on evidence likelihood. Applications range from medical diagnosis to spam filtering to AI machine learning.",
    domain: "math",
    routingMode: "enrich",
    conceptNames: ["Bayes' theorem", "conditional probability", "probability updating"],
    daysBack: 46,
  },
  {
    text: "How do viruses reproduce?",
    aiResponse:
      "Viruses cannot reproduce independently — they are obligate intracellular parasites. A virus attaches to a host cell using surface proteins that match host receptors, injects its genetic material (DNA or RNA), hijacks the cell's machinery to replicate viral components, assembles new virus particles, and lyses the cell (or buds off) to release hundreds or thousands of new viruses.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["viral replication", "host cell hijacking", "lytic cycle"],
    daysBack: 45,
  },
  {
    text: "Why does dividing by a fraction give a bigger number?",
    aiResponse:
      "Dividing by a fraction is the same as multiplying by its reciprocal. So 6 ÷ (1/3) = 6 × 3 = 18. The intuition: 'how many thirds fit into 6?' Six whole units, each containing 3 thirds — so 18 thirds fit. Division asks 'how many groups of this size fit?'; smaller groups fit more times, so dividing by something less than 1 gives a larger result.",
    domain: "math",
    routingMode: "diagnose",
    routingMisconceptionId: "math-002",
    conceptNames: ["fraction division", "reciprocals", "division intuition"],
    daysBack: 44,
  },
  {
    text: "How does the stock market work?",
    aiResponse:
      "A stock represents partial ownership of a company. Investors buy and sell stocks through exchanges (like NYSE or NASDAQ) based on expectations of future company performance. Prices are determined by supply and demand — when more people want to buy than sell, prices rise. Market indices like the S&P 500 aggregate hundreds of stocks to measure overall market direction.",
    domain: "math",
    routingMode: "enrich",
    conceptNames: ["stock markets", "supply and demand", "equity ownership"],
    daysBack: 43,
  },
  {
    text: "How do coral reefs form?",
    aiResponse:
      "Coral reefs are built by tiny animals called coral polyps that secrete calcium carbonate (limestone) skeletons. They live in symbiosis with photosynthetic algae called zooxanthellae, which provide food through photosynthesis. Over thousands of years, generations of polyp skeletons accumulate into vast reef structures. The Great Barrier Reef took about 20,000 years to form.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["coral reefs", "calcium carbonate", "symbiosis", "zooxanthellae"],
    daysBack: 42,
  },
  {
    text: "What is the speed of light and why can't anything exceed it?",
    aiResponse:
      "The speed of light in a vacuum (c) is 299,792,458 m/s. Einstein's special relativity shows that as an object with mass accelerates, its relativistic mass increases, requiring ever-more energy to accelerate further. Reaching c would require infinite energy. Additionally, the laws of causality would break down at faster-than-light speeds, creating temporal paradoxes.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["speed of light", "special relativity", "relativistic mass"],
    daysBack: 41,
  },
  {
    text: "How does photosynthesis produce ATP?",
    aiResponse:
      "During the light reactions of photosynthesis, chlorophyll absorbs photons, exciting electrons to higher energy levels. These excited electrons flow through the electron transport chain in the thylakoid membrane, pumping protons to create a gradient. ATP synthase harnesses this proton gradient to phosphorylate ADP into ATP — the same mechanism used in cellular respiration, but driven by light instead of sugar oxidation.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["ATP synthesis", "electron transport chain", "thylakoid membrane", "light reactions"],
    daysBack: 40,
  },
  {
    text: "Why does ice float on water?",
    aiResponse:
      "Most liquids are denser than their solid form, so solids sink. Water is exceptional: ice crystals have a hexagonal lattice structure where each water molecule hydrogen-bonds to four neighbors, spacing them farther apart than in liquid water. This open crystal structure makes ice less dense (0.917 g/cm³) than liquid water (1.0 g/cm³) — so ice floats. This property is critical for aquatic life surviving under frozen lake surfaces.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["ice density", "hydrogen bonding", "crystal structure"],
    daysBack: 39,
  },
  {
    text: "How does natural selection work without a goal?",
    aiResponse:
      "Natural selection has no foresight or goal — it operates on variation that already exists in a population. Individuals with heritable traits that improve survival and reproduction in their current environment leave more offspring. Over generations, advantageous traits become more common. There is no 'trying' involved; it's purely differential reproduction. Environments change, so what is 'adaptive' changes too.",
    domain: "biology",
    routingMode: "diagnose",
    routingMisconceptionId: "bio-005",
    conceptNames: ["natural selection", "heritable variation", "differential reproduction"],
    daysBack: 38,
  },
  {
    text: "What is the difference between heat and temperature?",
    aiResponse:
      "Temperature measures the average kinetic energy of particles in a substance. Heat is the total thermal energy transferred between objects due to temperature differences. A bathtub of warm water has a lower temperature than a cup of boiling water, but contains far more total heat because it has many more molecules. You can add heat to ice without raising its temperature (latent heat of fusion) during phase changes.",
    domain: "physics",
    routingMode: "diagnose",
    routingMisconceptionId: "phys-003",
    conceptNames: ["heat vs temperature", "thermal energy", "latent heat", "phase transitions"],
    daysBack: 37,
  },
  {
    text: "How does GPS work?",
    aiResponse:
      "GPS receivers calculate their position by measuring the time delay of radio signals from multiple satellites. Each satellite broadcasts its position and a precise timestamp. By comparing arrival times from at least 4 satellites, the receiver can triangulate its exact 3D position. Accurate timekeeping requires relativistic corrections — both special relativity (satellite clocks run slow) and general relativity (they run fast at altitude).",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["GPS triangulation", "satellite timing", "relativity corrections"],
    daysBack: 36,
  },
  {
    text: "How do cells differentiate if they all have the same DNA?",
    aiResponse:
      "Every cell in your body (with few exceptions) contains the same DNA, but different genes are expressed in different cell types. Gene expression is controlled by transcription factors, epigenetic marks (DNA methylation, histone modification), and signaling from neighboring cells. A liver cell and a neuron use the same instruction manual but read different chapters based on their developmental history.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["cell differentiation", "gene expression", "epigenetics", "transcription factors"],
    daysBack: 35,
  },
  {
    text: "What is the Fibonacci sequence and where does it appear in nature?",
    aiResponse:
      "The Fibonacci sequence (1, 1, 2, 3, 5, 8, 13, ...) is formed by adding the two preceding terms. It appears in plant phyllotaxis (leaf and seed arrangements), spiral patterns in sunflowers and nautilus shells, and branching patterns in trees and rivers. The ratio of consecutive Fibonacci numbers converges to the golden ratio (φ ≈ 1.618), which represents the most space-efficient packing in many growth contexts.",
    domain: "math",
    routingMode: "enrich",
    conceptNames: ["Fibonacci sequence", "golden ratio", "phyllotaxis"],
    daysBack: 34,
  },
  {
    text: "How does the brain perceive color?",
    aiResponse:
      "The retina contains three types of cone cells, each sensitive to different wavelength peaks: short (blue ~420nm), medium (green ~530nm), and long (red ~560nm). Color perception arises from comparing these three signals — your brain interprets the combination as a particular color. Color is a perceptual construct; the wavelengths themselves have no color — your brain creates it.",
    domain: "biology",
    routingMode: "enrich",
    conceptNames: ["color perception", "cone cells", "wavelength", "visual cortex"],
    daysBack: 33,
  },
  {
    text: "What is dark matter?",
    aiResponse:
      "Dark matter is a form of mass that doesn't interact with light or other electromagnetic radiation — it can only be detected through its gravitational effects. Evidence includes: galaxy rotation curves that require more mass than visible matter provides, gravitational lensing by invisible mass, and the large-scale structure of the universe. Dark matter makes up about 27% of the universe's mass-energy; its particle nature remains unknown.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["dark matter", "galaxy rotation", "gravitational lensing"],
    daysBack: 32,
  },
  {
    text: "How does the periodic table organize the elements?",
    aiResponse:
      "Elements are arranged in order of atomic number (protons in the nucleus) and grouped by electron configuration. Elements in the same column (group) share similar chemical properties because they have the same number of outer (valence) electrons. Rows (periods) represent filling of successive electron shells. Mendeleev's original arrangement predicted undiscovered elements by leaving gaps — a validation of the underlying pattern.",
    domain: "physics",
    routingMode: "enrich",
    conceptNames: ["periodic table", "atomic number", "electron configuration", "valence electrons"],
    daysBack: 31,
  },
];

// ─── main seed function ───────────────────────────────────────────────────────

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log("Clearing existing data...");

  // Delete in FK-safe order (children before parents)
  await db.execute(sql`DELETE FROM diagnostic_sessions`);
  await db.execute(sql`DELETE FROM concept_questions`);
  await db.execute(sql`DELETE FROM concept_edges`);
  await db.execute(sql`DELETE FROM concepts`);
  await db.execute(sql`DELETE FROM questions`);
  await db.execute(sql`DELETE FROM class_enrollments`);
  await db.execute(sql`DELETE FROM classes`);
  await db.execute(sql`DELETE FROM sessions`);
  await db.execute(sql`DELETE FROM accounts`);
  await db.execute(sql`DELETE FROM "verificationTokens"`);
  await db.execute(sql`DELETE FROM users`);

  console.log("Creating accounts...");

  const studentPasswordHash = await hash("password123", 10);
  const teacherPasswordHash = await hash("teacher123", 10);

  // Insert teacher
  const [teacher] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      name: "Ms. Rodriguez",
      email: "teacher@demo.mindmap",
      role: "teacher",
      passwordHash: teacherPasswordHash,
    })
    .returning();

  // Insert all students
  const studentValues = STUDENT_NAMES.map((name) => {
    const firstName = name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
    return {
      id: crypto.randomUUID(),
      name,
      email: `${firstName}@demo.mindmap`,
      role: "student" as const,
      passwordHash: studentPasswordHash,
    };
  });

  const insertedStudents = await db.insert(users).values(studentValues).returning();

  console.log(`Created 1 teacher + ${insertedStudents.length} students`);

  // Create class
  const [demoClass] = await db
    .insert(classes)
    .values({
      id: crypto.randomUUID(),
      name: "Grade 7 Science",
      joinCode: "DEMO7A",
      teacherId: teacher.id,
      gradeLevel: 7,
    })
    .returning();

  // Enroll all students
  await db.insert(classEnrollments).values(
    insertedStudents.map((student) => ({
      id: crypto.randomUUID(),
      classId: demoClass.id,
      studentId: student.id,
      gradeLevel: 7,
    }))
  );

  console.log(`Created class "${demoClass.name}" with ${insertedStudents.length} enrolled students`);

  // ── 30-day student (index 0 = Alex Chen) ──────────────────────────────────
  console.log("Seeding 30-day student (Alex Chen)...");

  const student30 = insertedStudents[0];
  const s30ConceptMap = new Map<string, string>(); // name -> id

  for (const q of QUESTIONS_30DAY) {
    const qId = crypto.randomUUID();
    await db.insert(questions).values({
      id: qId,
      userId: student30.id,
      text: q.text,
      aiResponse: q.aiResponse,
      routingMode: q.routingMode,
      routingMisconceptionId: q.routingMisconceptionId ?? null,
      createdAt: daysAgo(q.daysBack),
    });

    // Insert concepts for this question
    for (let i = 0; i < q.conceptNames.length; i++) {
      const cName = q.conceptNames[i];
      if (!s30ConceptMap.has(cName)) {
        const cId = crypto.randomUUID();
        const statuses = ["unprobed", "unprobed", "unprobed", "healthy", "healthy", "healthy", "healthy", "misconception"] as const;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const visitCount = Math.floor(Math.random() * 4) + 1;
        await db.insert(concepts).values({
          id: cId,
          userId: student30.id,
          name: cName,
          domain: q.domain,
          status,
          visitCount,
          embedding: null,
          createdAt: daysAgo(q.daysBack),
        });
        s30ConceptMap.set(cName, cId);
      }
      await db.insert(conceptQuestions).values({
        id: crypto.randomUUID(),
        conceptId: s30ConceptMap.get(cName)!,
        questionId: qId,
      });
    }
  }

  // ─── Rich edge creation for 30-day student ─────────────────────────────────
  // Helper to add an edge if both concepts exist
  const s30EdgeSet = new Set<string>();
  async function addEdge(nameA: string, nameB: string, type: "curiosity_link" | "bridge" | "misconception_cluster") {
    const idA = s30ConceptMap.get(nameA);
    const idB = s30ConceptMap.get(nameB);
    if (!idA || !idB || idA === idB) return;
    const [src, tgt] = idA < idB ? [idA, idB] : [idB, idA];
    const key = `${src}-${tgt}-${type}`;
    if (s30EdgeSet.has(key)) return;
    s30EdgeSet.add(key);
    await db.insert(conceptEdges).values({
      id: crypto.randomUUID(),
      sourceConceptId: src,
      targetConceptId: tgt,
      edgeType: type,
    });
  }

  // Same-question curiosity links (concepts extracted from the same question)
  for (const q of QUESTIONS_30DAY) {
    for (let i = 0; i < q.conceptNames.length; i++) {
      for (let j = i + 1; j < q.conceptNames.length; j++) {
        await addEdge(q.conceptNames[i], q.conceptNames[j], "curiosity_link");
      }
    }
  }

  // Same-domain connections — physics cluster
  await addEdge("gravity", "gravitational collapse", "curiosity_link");
  await addEdge("gravity", "gravitational gradient", "curiosity_link");
  await addEdge("gravity", "free fall", "curiosity_link");
  await addEdge("gravity", "aerodynamic lift", "curiosity_link");
  await addEdge("wavelength", "light scattering", "curiosity_link");
  await addEdge("wavelength", "reflection", "curiosity_link");
  await addEdge("electric current", "electromagnetism", "curiosity_link");
  await addEdge("electric current", "lightning", "curiosity_link");
  await addEdge("electromagnetism", "magnetism", "curiosity_link");
  await addEdge("electromagnetism", "electron spin", "curiosity_link");
  await addEdge("seismic waves", "tectonic plates", "curiosity_link");
  await addEdge("entropy", "thermodynamics", "curiosity_link");
  await addEdge("entropy", "statistical mechanics", "curiosity_link");
  await addEdge("black holes", "event horizon", "curiosity_link");
  await addEdge("black holes", "supernovae", "curiosity_link");
  await addEdge("stellar parallax", "light-years", "curiosity_link");
  await addEdge("orbital motion", "orbital period", "curiosity_link");
  await addEdge("orbital motion", "axial tilt", "curiosity_link");
  await addEdge("lunar phases", "tidal forces", "curiosity_link");
  await addEdge("reflection", "solar radiation angle", "curiosity_link");
  await addEdge("phase changes", "freezing point depression", "curiosity_link");

  // Same-domain connections — biology cluster
  await addEdge("immune response", "antibodies", "curiosity_link");
  await addEdge("immune response", "vaccines", "curiosity_link");
  await addEdge("immune response", "allergic response", "curiosity_link");
  await addEdge("vaccines", "pathogens", "curiosity_link");
  await addEdge("vaccines", "memory cells", "curiosity_link");
  await addEdge("antibodies", "IgE antibodies", "curiosity_link");
  await addEdge("T-cells", "memory cells", "curiosity_link");
  await addEdge("antibiotics", "pathogens", "curiosity_link");
  await addEdge("antibiotics", "cell wall synthesis", "curiosity_link");
  await addEdge("DNA structure", "genetic code", "curiosity_link");
  await addEdge("DNA structure", "proteins", "curiosity_link");
  await addEdge("photosynthesis", "chlorophyll", "curiosity_link");
  await addEdge("photosynthesis", "glucose", "curiosity_link");
  await addEdge("photosynthesis", "phototropism", "curiosity_link");
  await addEdge("phototropism", "auxin", "curiosity_link");
  await addEdge("phototropism", "plant hormones", "curiosity_link");
  await addEdge("hibernation", "metabolic rate", "curiosity_link");
  await addEdge("hibernation", "energy conservation", "curiosity_link");
  await addEdge("food chains", "mass extinction", "curiosity_link");
  await addEdge("neuroscience", "synaptic plasticity", "curiosity_link");
  await addEdge("neuroscience", "hippocampus", "curiosity_link");
  await addEdge("neuroscience", "memory consolidation", "curiosity_link");
  await addEdge("REM sleep", "neuroscience", "curiosity_link");

  // Bridge edges — surprise cross-domain connections
  await addEdge("entropy", "photosynthesis", "bridge");           // physics↔biology: energy systems
  await addEdge("gravity", "tidal forces", "bridge");             // gravity↔ocean dynamics
  await addEdge("electromagnetism", "magnetoreception", "bridge"); // physics↔biology: birds use EM fields
  await addEdge("electric current", "neuroscience", "bridge");    // physics↔biology: neurons are electrical
  await addEdge("electrons", "DNA structure", "bridge");          // physics↔biology: molecular bonds
  await addEdge("evaporation", "phase changes", "bridge");        // chemistry↔earth science
  await addEdge("memory consolidation", "binary systems", "bridge"); // biology↔CS: how memory works
  await addEdge("energy conservation", "entropy", "bridge");      // biology↔physics: energy laws
  await addEdge("light scattering", "stellar parallax", "bridge"); // atmospheric↔astronomical optics

  // Diagnostic sessions for 30-day student
  const s30ConceptIdsList = Array.from(s30ConceptMap.values());

  await db.insert(diagnosticSessions).values([
    {
      id: crypto.randomUUID(),
      userId: student30.id,
      conceptId: s30ConceptIdsList[0],
      misconceptionId: "phys-001",
      misconceptionName: "Heavier objects fall faster",
      stage: "resolve",
      outcome: "resolved",
      messages: [],
      createdAt: daysAgo(19),
    },
    {
      id: crypto.randomUUID(),
      userId: student30.id,
      conceptId: s30ConceptIdsList[1],
      misconceptionId: "bio-001",
      misconceptionName: "Plants get their food from the soil",
      stage: "resolve",
      outcome: "unresolved",
      messages: [],
      createdAt: daysAgo(28),
    },
    {
      id: crypto.randomUUID(),
      userId: student30.id,
      conceptId: s30ConceptIdsList[2],
      misconceptionId: "phys-005",
      misconceptionName: "Seasons are caused by Earth's distance from the Sun",
      stage: "confront",
      outcome: null,
      messages: [],
      createdAt: daysAgo(3),
    },
  ]);

  console.log(`30-day student: ${s30ConceptMap.size} concepts, ${s30EdgeSet.size} edges, 3 diagnostic sessions`);

  // ── 60-day student (index 1 = Jordan Williams) ────────────────────────────
  console.log("Seeding 60-day student (Jordan Williams)...");

  const student60 = insertedStudents[1];
  const s60ConceptMap = new Map<string, string>();

  const allQ60 = [...QUESTIONS_30DAY, ...QUESTIONS_60DAY_EXTRA];
  // Adjust 30-day questions to be 60 days back for this student
  const q60Adjusted = allQ60.map((q, i) => ({
    ...q,
    daysBack: i < QUESTIONS_30DAY.length ? q.daysBack + 30 : q.daysBack,
  }));

  for (const q of q60Adjusted) {
    const qId = crypto.randomUUID();
    await db.insert(questions).values({
      id: qId,
      userId: student60.id,
      text: q.text,
      aiResponse: q.aiResponse,
      routingMode: q.routingMode,
      routingMisconceptionId: q.routingMisconceptionId ?? null,
      createdAt: daysAgo(q.daysBack),
    });

    for (const cName of q.conceptNames) {
      if (!s60ConceptMap.has(cName)) {
        const cId = crypto.randomUUID();
        const statuses = ["healthy", "healthy", "healthy", "healthy", "unprobed", "unprobed", "misconception"] as const;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const visitCount = Math.floor(Math.random() * 7) + 2;
        await db.insert(concepts).values({
          id: cId,
          userId: student60.id,
          name: cName,
          domain: q.domain,
          status,
          visitCount,
          embedding: null,
          createdAt: daysAgo(q.daysBack),
        });
        s60ConceptMap.set(cName, cId);
      }
      await db.insert(conceptQuestions).values({
        id: crypto.randomUUID(),
        conceptId: s60ConceptMap.get(cName)!,
        questionId: qId,
      });
    }
  }

  // curiosity_link edges for 60-day student (~25)
  const s60ConceptIds = Array.from(s60ConceptMap.values());
  const s60EdgeSet = new Set<string>();
  let s60EdgeCount = 0;
  for (let i = 0; i < s60ConceptIds.length - 1 && s60EdgeCount < 25; i++) {
    const key = `${s60ConceptIds[i]}-${s60ConceptIds[i + 1]}`;
    if (!s60EdgeSet.has(key)) {
      s60EdgeSet.add(key);
      await db.insert(conceptEdges).values({
        id: crypto.randomUUID(),
        sourceConceptId: s60ConceptIds[i],
        targetConceptId: s60ConceptIds[i + 1],
        edgeType: "curiosity_link",
      });
      s60EdgeCount++;
    }
  }

  // 4 bridge edges for 60-day student
  const bridgePairs: [string, string][] = [
    ["entropy", "ATP synthesis"],
    ["quantum mechanics", "DNA structure"],
    ["photosynthesis", "greenhouse effect"],
    ["gravity", "dark matter"],
  ];
  for (const [a, b] of bridgePairs) {
    const aId = s60ConceptMap.get(a);
    const bId = s60ConceptMap.get(b);
    if (aId && bId && aId !== bId) {
      const key = `${aId}-${bId}`;
      if (!s60EdgeSet.has(key)) {
        s60EdgeSet.add(key);
        await db.insert(conceptEdges).values({
          id: crypto.randomUUID(),
          sourceConceptId: aId,
          targetConceptId: bId,
          edgeType: "bridge",
        });
      }
    }
  }

  // 5 diagnostic sessions for 60-day student (3 resolved, 1 unresolved, 1 in-progress)
  const s60ConceptIdsList = Array.from(s60ConceptMap.values());
  await db.insert(diagnosticSessions).values([
    {
      id: crypto.randomUUID(),
      userId: student60.id,
      conceptId: s60ConceptIdsList[0],
      misconceptionId: "phys-001",
      misconceptionName: "Heavier objects fall faster",
      stage: "resolve",
      outcome: "resolved",
      messages: [],
      createdAt: daysAgo(50),
    },
    {
      id: crypto.randomUUID(),
      userId: student60.id,
      conceptId: s60ConceptIdsList[1],
      misconceptionId: "bio-001",
      misconceptionName: "Plants get their food from the soil",
      stage: "resolve",
      outcome: "resolved",
      messages: [],
      createdAt: daysAgo(42),
    },
    {
      id: crypto.randomUUID(),
      userId: student60.id,
      conceptId: s60ConceptIdsList[2],
      misconceptionId: "math-001",
      misconceptionName: "Multiplication always makes numbers bigger",
      stage: "resolve",
      outcome: "resolved",
      messages: [],
      createdAt: daysAgo(35),
    },
    {
      id: crypto.randomUUID(),
      userId: student60.id,
      conceptId: s60ConceptIdsList[3],
      misconceptionId: "phys-005",
      misconceptionName: "Seasons are caused by Earth's distance from the Sun",
      stage: "resolve",
      outcome: "unresolved",
      messages: [],
      createdAt: daysAgo(20),
    },
    {
      id: crypto.randomUUID(),
      userId: student60.id,
      conceptId: s60ConceptIdsList[4],
      misconceptionId: "bio-005",
      misconceptionName: "Evolution means organisms try to adapt",
      stage: "confront",
      outcome: null,
      messages: [],
      createdAt: daysAgo(7),
    },
  ]);

  console.log(
    `60-day student: ${s60ConceptMap.size} concepts, ${s60EdgeCount} curiosity + bridge edges, 5 diagnostic sessions`
  );

  // ── Remaining 20 students (indices 2-21) ──────────────────────────────────
  console.log("Seeding remaining 20 students with varied engagement...");

  // Question pool to pick from for varied students
  const enrichQuestionPool = QUESTIONS_30DAY.filter((q) => q.routingMode === "enrich");

  let totalAdditionalSessions = 0;

  for (let idx = 2; idx < insertedStudents.length; idx++) {
    const student = insertedStudents[idx];

    let questionCount: number;
    let addDiagnostic: boolean;

    if (idx <= 5) {
      // Moderate engagement: 10-15 questions
      questionCount = 10 + (idx - 2) * Math.floor(Math.random() * 2 + 1);
      if (questionCount > 15) questionCount = 15;
      addDiagnostic = true;
    } else if (idx <= 10) {
      // Light engagement: 3-7 questions
      questionCount = 3 + Math.floor(Math.random() * 4);
      addDiagnostic = totalAdditionalSessions < 5;
    } else if (idx <= 15) {
      // Minimal: 1-2 questions
      questionCount = 1 + Math.floor(Math.random() * 2);
      addDiagnostic = false;
    } else if (idx <= 19) {
      // Inactive: 0 questions
      questionCount = 0;
      addDiagnostic = false;
    } else {
      // High engagement: 20-25 questions
      questionCount = 20 + Math.floor(Math.random() * 5);
      addDiagnostic = false;
    }

    if (questionCount === 0) continue;

    const studentConceptMap = new Map<string, string>();

    for (let qIdx = 0; qIdx < questionCount; qIdx++) {
      const template = enrichQuestionPool[qIdx % enrichQuestionPool.length];
      const daysBack = Math.floor(Math.random() * 28) + 1;
      const qId = crypto.randomUUID();

      await db.insert(questions).values({
        id: qId,
        userId: student.id,
        text: template.text,
        aiResponse: template.aiResponse,
        routingMode: "enrich",
        routingMisconceptionId: null,
        createdAt: daysAgo(daysBack),
      });

      // Add 1-2 concepts per question
      const numConcepts = Math.min(2, template.conceptNames.length);
      for (let ci = 0; ci < numConcepts; ci++) {
        const cName = `${template.conceptNames[ci]}_${idx}`;
        if (!studentConceptMap.has(cName)) {
          const cId = crypto.randomUUID();
          await db.insert(concepts).values({
            id: cId,
            userId: student.id,
            name: template.conceptNames[ci],
            domain: template.domain,
            status: pick(["unprobed", "healthy", "unprobed"]),
            visitCount: Math.floor(Math.random() * 3) + 1,
            embedding: null,
            createdAt: daysAgo(daysBack),
          });
          studentConceptMap.set(cName, cId);
        }
        await db.insert(conceptQuestions).values({
          id: crypto.randomUUID(),
          conceptId: studentConceptMap.get(cName)!,
          questionId: qId,
        });
      }
    }

    // Add some edges between concepts
    const cIds = Array.from(studentConceptMap.values());
    const edgeSet = new Set<string>();
    for (let ei = 0; ei < cIds.length - 1 && ei < 5; ei++) {
      const key = `${cIds[ei]}-${cIds[ei + 1]}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        await db.insert(conceptEdges).values({
          id: crypto.randomUUID(),
          sourceConceptId: cIds[ei],
          targetConceptId: cIds[ei + 1],
          edgeType: "curiosity_link",
        });
      }
    }

    // Add diagnostic session for some students
    if (addDiagnostic && cIds.length > 0 && totalAdditionalSessions < 8) {
      const misconceptions = [
        { id: "phys-001", name: "Heavier objects fall faster" },
        { id: "bio-001", name: "Plants get their food from the soil" },
        { id: "math-001", name: "Multiplication always makes numbers bigger" },
        { id: "phys-005", name: "Seasons are caused by Earth's distance from the Sun" },
        { id: "bio-009", name: "Vaccines give you the disease they protect against" },
        { id: "hist-001", name: "Columbus proved the Earth was round" },
      ];
      const misconception = misconceptions[totalAdditionalSessions % misconceptions.length];
      await db.insert(diagnosticSessions).values({
        id: crypto.randomUUID(),
        userId: student.id,
        conceptId: cIds[0],
        misconceptionId: misconception.id,
        misconceptionName: misconception.name,
        stage: pick(["probe", "classify", "confront", "resolve"]),
        outcome: pick([null, "resolved", "unresolved"]),
        messages: [],
        createdAt: daysAgo(Math.floor(Math.random() * 20) + 1),
      });
      totalAdditionalSessions++;
    }
  }

  console.log(`Additional ${totalAdditionalSessions} diagnostic sessions across remaining students`);

  await pool.end();
  console.log("\nSeed complete! Demo data inserted successfully.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
