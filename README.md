PENEMUE ZERO

THINK BEYOND LIMITS. PROVE THROUGH DISCOVERY.

PENEMUE ZERO is an experimental, multi-agent AI research assistant designed to investigate difficult questions, challenge assumptions, preserve research knowledge, and develop better research strategies over time.

Its mission is to explore unanswered questions across science, consciousness, fundamental physics, mathematics, astronomy, ancient history, and the origins of life.

Core Features

* Multi-agent research pipeline: Planner, investigator, skeptic, and synthesis agents.
* Web research: Search for external evidence and supporting sources.
* Persistent memory: Save project memories and retrieve relevant information for future research.
* Research workspace: Create, save, run, and review research tasks.
* Evidence-aware synthesis: Compare findings and counterarguments before producing conclusions.
* Custom personality: Configure PENEMUE ZERO’s research instructions and behavior.
* Data portability: Export and import project data as JSON.
* iPhone-friendly interface: Mobile-first installable web application.

Multi-Agent Architecture

1. Research Planner — Breaks complex questions into investigative tasks.
2. Investigator — Searches for evidence and relevant sources.
3. Skeptic — Challenges assumptions and searches for contradictory evidence.
4. Synthesis Engine — Combines the results into a structured research report.

Research Principles

PENEMUE ZERO is designed to:

* Question established assumptions.
* Distinguish evidence from speculation.
* Preserve competing hypotheses.
* Identify uncertainty and knowledge gaps.
* Track sources and confidence.
* Seek falsifiable tests.
* Avoid presenting unsupported claims as discoveries.

Technology

* Node.js 20+
* Express
* OpenAI API
* SQLite
* HTML, CSS, and JavaScript
* Progressive Web App support

Installation

Requirements: Node.js 20+ and an OpenAI API key.

1. Install dependencies:
    npm install
2. Copy .env.example to .env.
3. Configure the environment variables:
    * OPENAI_API_KEY
    * OPENAI_MODEL
    * APP_PASSWORD
    * SESSION_SECRET
4. Start the application:
    npm start
5. Open the application using its hosted HTTPS address.

Keep API credentials on the server. Never commit .env or private credentials to GitHub.

Persistent storage is required for the SQLite database.

Continuous Intelligence — Future Development

The long-term objective is to evolve PENEMUE ZERO into a continuously operating research system.

Planned engineering capabilities:

* Automated background research cycles.
* Continuous generation and prioritization of research questions.
* Long-term searchable knowledge storage.
* Semantic memory retrieval.
* Research history and knowledge graph.
* Independent verification and source evaluation.
* Prediction tracking and research benchmarks.
* Automated evaluation of research quality.
* Controlled testing of improved research strategies.
* Background workers, scheduled tasks, retries, and recovery.
* Cost monitoring and configurable resource limits.

Important: These are development goals, not claims that the current V4 build already performs them. Current research tasks run when manually triggered. Continuous background research is not yet implemented.

Current Status

PENEMUE ZERO V4 — Multi-Agent Starter

This is an experimental software project, not a newly trained foundation model or a copy of GPT-6. It uses an external model API and is subject to model availability, API costs, and provider policies.

The current security controls are prototype-level. A production security review, stronger authentication, persistent rate limiting, backups, and additional protections are needed before public release.

Mission

Build an increasingly capable research system through accumulated knowledge, critical evaluation, experimentation, and measurable improvements.

Question assumptions. Investigate evidence. Discover what remains unknown.

THINK BEYOND LIMITS. PROVE THROUGH DISCOVERY.
