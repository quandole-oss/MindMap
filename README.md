# MindMap

**AI-powered educational tool that reveals what students actually believe — not just what they got wrong.**

MindMap combines a daily curiosity engine with a misconception diagnostic system for K-12 learners. Students ask one question per day about anything they're curious about. The AI answers, extracts concepts, and builds a personal knowledge graph — a living, visual web of everything they've explored. When a concept is commonly misunderstood, the system shifts into diagnostic mode: probing the student's mental model through Socratic dialogue, classifying misconceptions against a research-backed library, and generating cognitive conflict to trigger genuine understanding.

## Why MindMap Exists

Education technology is obsessed with what students get wrong. Red X's on quizzes. Percentage scores. "Try again." But none of that answers the question that actually matters: **why does the student believe what they believe?**

A student who says "plants get their food from the soil" isn't guessing randomly — they have a coherent mental model where that makes sense. Until you surface that model, challenge it, and let the student reconcile it themselves, no amount of correct-answer drilling will produce real understanding. The misconception just hides until the next test.

Meanwhile, curiosity — the single strongest predictor of deep learning — gets zero infrastructure in most classrooms. There's no system that says: *what are you wondering about today?* and then connects that wonder to what you already know.

MindMap changes that.

## What It Does

- **One question a day.** Students ask whatever they're genuinely curious about. The AI answers at an age-appropriate level, extracts core concepts, and maps them onto the student's personal knowledge graph.

- **Misconception diagnosis.** When a concept is commonly misunderstood, the system enters diagnostic mode — Socratic questions probe what the student actually thinks, classify their mental model against a research-backed misconception library, and create cognitive conflict to drive real understanding.

- **Knowledge graph.** Every question, concept, and connection becomes a visual, explorable map. Students see how photosynthesis connects to their question about why leaves change color, which connects to why some animals hibernate. Knowledge stops being isolated chapters and becomes a web they built themselves.

- **Teacher dashboard.** Educators see curiosity patterns (what topics are trending), misconception clusters (where multiple students share the same flawed model), and engagement signals — all without reducing a student to a number.

## What Makes This Different

- **Curiosity-first, not assessment-first.** The entry point is a question the student wants to ask, not a question someone else wrote for them.
- **Diagnosis over grading.** The system classifies *what kind* of misunderstanding exists and *why* it's stable in the student's mind — not just that an answer was wrong.
- **Privacy by design.** No telemetry, no data sent home. All student data stays on the deployer's infrastructure. Self-hostable via Docker Compose.
- **The graph is the product.** Not a score, not a leaderboard, not a badge. A visual map of how one mind understands the world, growing one question at a time.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15, React 19, TypeScript |
| Database | PostgreSQL 16 + pgvector, Drizzle ORM |
| LLM | Vercel AI SDK + Anthropic Claude (adapter pattern for OpenAI/Ollama) |
| Visualization | D3.js force-directed graph |
| Auth | Auth.js v5 |
| Styling | Tailwind CSS v4, shadcn/ui |
| Monorepo | Turborepo + pnpm |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL 16 with pgvector extension (or Docker)

### Setup

```bash
# Clone the repo
git clone https://github.com/quandole-oss/MindMap.git
cd MindMap

# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local with your database URL and API keys

# Run database migrations
pnpm db:migrate

# Start the dev server
pnpm dev
```

## Project Structure

```
MindMap/
  apps/
    web/          # Next.js application
  packages/
    db/           # Database schema, migrations, queries (Drizzle)
    llm/          # LLM provider abstraction (Vercel AI SDK)
    misconceptions/  # YAML misconception library + validation
    router/       # Concept extraction and routing logic
```

## Contributing

Contributions are welcome. The misconception library (`packages/misconceptions`) is YAML + Git, version-controlled, CI-validated, and designed to be community-extensible. If you're an educator or researcher with misconception data, that's the highest-impact place to contribute.

## License

MIT
