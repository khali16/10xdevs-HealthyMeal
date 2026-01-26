### HealthyMeal

Modern web app that helps users adapt recipes to individual dietary needs with AI assistance. The MVP focuses on private recipe CRUD, a quick dietary preferences profile, and a single "Adjust Recipe" AI action with diff preview and post-AI safety validation.

![Node](https://img.shields.io/badge/node-22.14.0-43853d?logo=node.js&logoColor=white)
![Astro](https://img.shields.io/badge/Astro-5-BC52EE?logo=astro)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=06142A)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

---

### Table of Contents

- [Project name](#healthymeal)
- [Project description](#project-description)
- [Tech stack](#tech-stack)
- [Getting started locally](#getting-started-locally)
- [Available scripts](#available-scripts)
- [Project scope](#project-scope)
- [Project status](#project-status)
- [License](#license)

### Project description

HealthyMeal is a responsive web app that structures pasted recipes, normalizes units, and lets users apply a single AI-powered "Adjust Recipe" action tailored to their dietary profile (allergens, exclusions, macro/calorie goals).

Key MVP highlights:

- Private recipe CRUD with sorting (Newest, Favorites, Highest Rated) and tie-breaker by updatedAt.
- Onboarding for dietary preferences (EU 14 allergens, exclusions, diet). Optional calories/servings.
- Single AI action with diff preview, legal disclaimer, rate limits, retries, and clear error statuses.
- Post-AI validation for the 14 EU allergens with synonyms/compound ingredients and soft blocks on uncertainty.
- Portions scaler with rounding rules and "do not scale" flag per ingredient.
- Minimal analytics and logging for key events (authentication and AI actions).

Further details: see the PRD at `./.ai/prd.md`.

### Tech stack

- **Frontend**: Astro 5, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui
- **Core libraries**: `@astrojs/react`, `@astrojs/node`, `@tailwindcss/vite`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`
- **Backend**: Supabase (PostgreSQL, auth, and SDK)
- **AI**: OpenRouter.ai (access to multiple model providers with budget controls)
- **CI/CD & Hosting**: GitHub Actions (CI/CD), DigitalOcean (Docker image hosting)
- **Tooling**: ESLint, Prettier, TypeScript, Husky + lint-staged
- **Testing**: Vitest (unit/integration), React Testing Library (component), Playwright (E2E)

Reference: `./.ai/tech-stack.md`

Notes:

- Recommended browsers: Chrome, Safari, Edge.
- When backend and AI integrations are wired in, typical environment variables will include Supabase and OpenRouter credentials (to be documented alongside integration).

### Project scope

In scope (MVP):

- Accounts and preferences profile with quick onboarding (≤60s) and soft gate.
- Private text-based recipe CRUD; owner-only visibility.
- Single AI action "Adjust Recipe" with diff preview and safety validation.
- "Structure" step with confidence indicators and unit normalization to g/ml/unit.
- Quick list filters and presets; ratings and favorites; servings scaler.
- Admin panel for allergens/synonyms dictionary (role + feature flag) with audit log.

Out of scope (for MVP):

- Recipe import from URL.
- Extended media support (photos, video).
- Social/sharing features.
- Recipe versioning.

Assumptions & dependencies (selected):

- Availability and budget for the chosen AI model/provider.
- Unified JSON contract for the "Structure" step (confidence, fields, validations).
- Browser support: Chrome, Safari, Edge.

For the full scope and user stories, see `./.ai/prd.md`.

### Project status

MVP in active development. Core flows to deliver: authentication and onboarding, private recipe CRUD, AI "Adjust Recipe" with post-AI validation, and essential analytics/logging. Not yet production-ready.

### API Quickstart

POST /api/recipes (uses DEFAULT_USER_ID for now)

```bash
curl -X POST http://localhost:3000/api/recipes \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Tofu Stir Fry",
    "ingredients": [{ "text": "200 g tofu", "unit": "g", "amount": 200 }],
    "steps": ["Press tofu", "Stir fry"],
    "tags": { "diet": "vegan" },
    "prep_time_minutes": 10,
    "cook_time_minutes": 15,
    "servings": 2
  }'
```

Notes:
- Configure `SUPABASE_URL`, `SUPABASE_KEY`, and optionally `SUPABASE_DEFAULT_USER_ID` in your env. If the default is missing, the endpoint returns 500.
- Body size is limited (~256KB) and basic rate limiting applies (middleware).

### License

TBD. This repository does not currently specify a license. Add a `LICENSE` file to define usage terms.

# 10x Astro Starter

A modern, opinionated starter template for building fast, accessible, and AI-friendly web applications.

## Tech Stack

- [Astro](https://astro.build/) v5.5.5 - Modern web framework for building fast, content-focused websites
- [React](https://react.dev/) v19.0.0 - UI library for building interactive components
- [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4.0.17 - Utility-first CSS framework
- Testing: Vitest, React Testing Library, Playwright (E2E)

## Prerequisites

- Node.js v22.14.0 (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run test:unit` - Run unit/component tests (Vitest)
- `npm run test:unit:watch` - Run unit/component tests in watch mode
- `npm run test:unit:ui` - Run Vitest UI
- `npm run test:e2e:install` - Install Playwright Chromium browser (required once per machine)
- `npm run test:e2e` - Run E2E tests (Playwright, Chromium only)
- `npm run test:e2e:ui` - Run Playwright UI mode
- `npm run test` - Run unit tests, then E2E

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── e2e/ # Playwright E2E tests (Page Object Model)
├── public/ # Public assets
```

## AI Development Support

This project is configured with AI development tools to enhance the development experience, providing guidelines for:

- Project structure
- Coding practices
- Frontend development
- Styling with Tailwind
- Accessibility best practices
- Astro and React guidelines

### Cursor IDE

The project includes AI rules in `.cursor/rules/` directory that help Cursor IDE understand the project structure and provide better code suggestions.

### GitHub Copilot

AI instructions for GitHub Copilot are available in `.github/copilot-instructions.md`

### Windsurf

The `.windsurfrules` file contains AI configuration for Windsurf.

## Contributing

Please follow the AI guidelines and coding practices defined in the AI configuration files when contributing to this project.

## License

MIT
