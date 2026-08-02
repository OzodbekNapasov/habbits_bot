const fs = require('fs');
const path = require('path');

const skills = [
  {
    name: 'securing-node-apps',
    description: 'Node.js security best practices, input sanitization, rate limiting, and environment variable protection.',
    content: `# Securing Node Applications Skill\n\n## Guidelines\n1. **Environment Protection**: Never commit secrets or API tokens to git repository. Use .env and dotenv.\n2. **Input Sanitization**: Sanitize all user inputs to prevent XSS, command injection, and SQL injection.\n3. **Rate Limiting**: Protect endpoints against brute-force and DoS attacks using rate limiters.\n4. **Security Headers**: Use Helmet or set CSP, HSTS, X-Frame-Options, X-Content-Type-Options.\n5. **Dependency Audit**: Routinely run \`npm audit\` to fix vulnerable packages.`
  },
  {
    name: 'performance-tuning',
    description: 'Memory leak prevention, event loop monitoring, bundle optimization, and code execution speedups.',
    content: `# Performance Tuning Skill\n\n## Guidelines\n1. **Event Loop Non-Blocking**: Offload CPU-heavy tasks to worker threads or background processes.\n2. **Memory Profiling**: Monitor heap usage and clean up global event listeners and timers.\n3. **Caching**: Store frequently queried read-only data in memory or Redis cache.\n4. **Async Optimization**: Use \`Promise.all()\` for parallel independent async operations.\n5. **Lightweight Dependencies**: Prefer native APIs and minimal utility libraries over heavy dependencies.`
  },
  {
    name: 'code-refactoring',
    description: 'Refactoring strategies, clean code principles, DRY, SOLID, and eliminating code smells.',
    content: `# Code Refactoring Skill\n\n## Guidelines\n1. **DRY (Don't Repeat Yourself)**: Extract repeated logic into reusable helper functions.\n2. **Single Responsibility**: Ensure each module, class, and function has one clear task.\n3. **Small Functions**: Keep functions under 30 lines for maximum readability and testability.\n4. **Meaningful Naming**: Use clear, descriptive variable and function names.\n5. **Remove Dead Code**: Delete unused imports, functions, and commented-out legacy code.`
  },
  {
    name: 'unit-testing-jest-vitest',
    description: 'Writing comprehensive unit and integration tests using Jest or Vitest.',
    content: `# Unit Testing Skill\n\n## Guidelines\n1. **AAA Pattern**: Structure tests using Arrange, Act, Assert.\n2. **Mocking External I/O**: Mock database, network requests, and external APIs in unit tests.\n3. **Edge Case Coverage**: Test null inputs, boundary values, empty arrays, and error handling paths.\n4. **Fast Execution**: Keep unit tests fast so they run seamlessly in development and CI.\n5. **Determinism**: Avoid dependency on real timers or live network services; use fake timers.`
  },
  {
    name: 'docker-containerization',
    description: 'Multi-stage Dockerfiles, docker-compose configuration, and container deployment.',
    content: `# Docker Containerization Skill\n\n## Guidelines\n1. **Multi-Stage Builds**: Separate build phase from runtime image to produce minimal production containers.\n2. **Non-Root User**: Run container processes under non-root users (\`node\`) for security.\n3. **.dockerignore**: Exclude \`node_modules\`, \`.git\`, and local secrets from container context.\n4. **Layer Caching**: Copy \`package.json\` before \`npm install\` to leverage layer caching.\n5. **Healthchecks**: Include HEALTHCHECK instructions for container orchestration.`
  },
  {
    name: 'vercel-deployment',
    description: 'Vercel serverless deployment, routing, edge functions, and environment configuration.',
    content: `# Vercel Deployment Skill\n\n## Guidelines\n1. **Serverless Functions**: Export clean default request/response handlers in \`api/\` directory.\n2. **Stateless Operations**: Serverless functions must remain stateless; rely on database for persistence.\n3. **vercel.json Routing**: Configure static files, API routes, and fallbacks cleanly in \`vercel.json\`.\n4. **Cold Start Minimization**: Keep dependencies lean in \`api/\` entry points.\n5. **Environment Variables**: Configure secrets in Vercel project settings.`
  },
  {
    name: 'cron-job-scheduling',
    description: 'Background cron job setup, node-cron scheduling, and timezone management.',
    content: `# Cron Job Scheduling Skill\n\n## Guidelines\n1. **Timezone Awareness**: Always specify explicit timezones (e.g. \`Asia/Tashkent\`) when scheduling.\n2. **Execution Locking**: Prevent overlapping job runs using concurrency flags or locks.\n3. **Error Isolation**: Wrap job execution bodies in \`try/catch\` blocks to keep cron process running.\n4. **Logging**: Log start time, duration, and completion status of scheduled jobs.\n5. **Serverless Cron**: Use external ping services or platform cron (Vercel Cron) in serverless setups.`
  },
  {
    name: 'modern-web-ui',
    description: 'Modern web UI design, glassmorphism, responsive CSS grid/flexbox, typography, and micro-interactions.',
    content: `# Modern Web UI Skill\n\n## Guidelines\n1. **Visual Excellence**: Use sleek dark mode, soft glassmorphism, and smooth linear gradients.\n2. **Modern Typography**: Use Google Fonts (e.g. Inter, Outfit) with clear hierarchy.\n3. **Interactive Hover & Focus**: Add smooth CSS transitions (\`ease-in-out 0.2s\`) for active states.\n4. **Responsive Layouts**: Use CSS Grid and Flexbox for seamless adaptation across mobile & desktop.\n5. **Semantic Elements**: Use HTML5 \`<header>\`, \`<main>\`, \`<section>\`, \`<article>\`, \`<footer>\`.`
  },
  {
    name: 'telegram-mini-app',
    description: 'Building Telegram WebApp / Mini Apps with Telegram SDK, theme integration, and viewport adaptation.',
    content: `# Telegram Mini App Skill\n\n## Guidelines\n1. **Telegram WebApp SDK**: Initialize \`window.Telegram.WebApp.ready()\` and \`expand()\`. \n2. **User Context Parsing**: Extract user info safely from \`tg.initDataUnsafe\`. \n3. **Theme Alignment**: Match background colors and text styles to Telegram theme parameters.\n4. **Haptic Feedback**: Use \`tg.HapticFeedback\` for button presses and user interactions.\n5. **REST API Integration**: Connect WebApp UI seamlessly to backend \`/api/\` endpoints.`
  },
  {
    name: 'git-workflow-clean-commits',
    description: 'Git branching strategy, conventional commit standards, and clean repository maintenance.',
    content: `# Git Workflow Skill\n\n## Guidelines\n1. **Conventional Commits**: Format commit messages as \`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, \`test:\`.\n2. **Small Atomic Commits**: Keep each commit focused on a single logical change.\n3. **Branching**: Use feature branches (\`feat/name\`) and merge into \`main\`.\n4. **Clean .gitignore**: Exclude local build artifacts, environment secrets, and OS junk files.\n5. **No Force Push Main**: Protect \`main\` branch and avoid force pushing shared branches.`
  },
  {
    name: 'logging-monitoring',
    description: 'Structured logging (Pino/Winston), log formatting, levels, and error tracking.',
    content: `# Logging & Monitoring Skill\n\n## Guidelines\n1. **Structured JSON Logs**: Log in JSON format for easy parsing and log aggregator ingestion.\n2. **Appropriate Log Levels**: Use \`debug\`, \`info\`, \`warn\`, and \`error\` correctly.\n3. **No Sensitive Data**: Sanitize passwords, auth tokens, and personal data from logs.\n4. **Request Tracing**: Attach unique correlation IDs to trace logs across HTTP requests.\n5. **Performance Impact**: Keep loggers fast and non-blocking.`
  },
  {
    name: 'env-config-management',
    description: 'Secure environment variable management, schema validation with Zod/Joi, and defaults.',
    content: `# Environment Config Management Skill\n\n## Guidelines\n1. **Strict Validation**: Validate all environment variables at startup using a schema.\n2. **Type-Safe Config**: Expose a typed configuration object across the codebase.\n3. **Example Config File**: Maintain an up-to-date \`.env.example\` without real secrets.\n4. **Fallback Defaults**: Provide safe default values for non-critical config parameters.\n5. **Zero Exposure**: Ensure \`.env\` files are listed in \`.gitignore\`.`
  },
  {
    name: 'web-scraping-automation',
    description: 'Web scraping, Puppeteer, Playwright, cheerio HTML parsing, and anti-bot handling.',
    content: `# Web Scraping & Automation Skill\n\n## Guidelines\n1. **Respect Robots & Rate Limits**: Add delays between requests to avoid overloading target servers.\n2. **Headless Browser Optimization**: Disable images, CSS, and fonts when automating for speed.\n3. **Robust Selectors**: Use reliable data attributes or semantic selectors over fragile dynamic class names.\n4. **Timeout Handling**: Always set explicit timeouts for element waiting and network idle.\n5. **Resource Cleanup**: Close browser instances and pages in \`finally\` blocks.`
  },
  {
    name: 'async-programming-mastery',
    description: 'Promise management, async/await patterns, event emitters, streams, and concurrency limits.',
    content: `# Async Programming Mastery Skill\n\n## Guidelines\n1. **Always Await Promises**: Avoid floating promises that lead to unhandled rejections.\n2. **Parallel Concurrency**: Use \`Promise.allSettled()\` when operating on batch items where partial success is acceptable.\n3. **Async Iteration**: Use \`for await (... of ...)\` for stream reading or paginated async loops.\n4. **Event Emitter Safety**: Remove event listeners when components unmount or complete.\n5. **AbortController**: Pass \`AbortSignal\` to cancel long-running HTTP fetches or timeouts.`
  },
  {
    name: 'authentication-authorization',
    description: 'JWT, OAuth2, session management, RBAC, password hashing, and token handling.',
    content: `# Authentication & Authorization Skill\n\n## Guidelines\n1. **Secure Hashing**: Use \`argon2\` or \`bcrypt\` with strong salt rounds for password storage.\n2. **JWT Best Practices**: Sign JWTs with strong secrets, set short expiration times, and verify algorithm.\n3. **Role-Based Access Control**: Enforce authorization checks at the route/service level.\n4. **HttpOnly Cookies**: Store refresh tokens in HttpOnly, SameSite, Secure cookies.\n5. **Token Invalidation**: Implement token revocation/blacklisting mechanisms.`
  },
  {
    name: 'graphql-api',
    description: 'GraphQL schema design, query resolvers, DataLoader batching, and performance tuning.',
    content: `# GraphQL API Skill\n\n## Guidelines\n1. **Schema First**: Define clear GraphQL types, inputs, and mutations in SDL.\n2. **DataLoader**: Use DataLoader to batch and cache database requests to eliminate N+1 queries.\n3. **Query Depth Limiting**: Enforce query complexity and depth limits to prevent DoS attack vectors.\n4. **Clear Mutations**: Design explicit input types for mutations and return payload types.\n5. **Error Formatting**: Sanitize internal server error stack traces in production responses.`
  },
  {
    name: 'ci-cd-github-actions',
    description: 'Automated CI/CD pipelines with GitHub Actions, testing, linting, and deployment.',
    content: `# CI/CD GitHub Actions Skill\n\n## Guidelines\n1. **Automated Checks**: Run linting, type-checking (\`tsc\`), and unit tests on every Pull Request.\n2. **Caching Dependencies**: Use \`actions/setup-node\` with package manager caching (\`npm\`/\`pnpm\`/\`yarn\`).\n3. **Secret Protection**: Store tokens and keys in GitHub Repository Secrets.\n4. **Matrix Testing**: Test across multiple Node.js runtime versions if publishing packages.\n5. **Fast Pipeline**: Keep build steps parallelized for quick feedback loops.`
  },
  {
    name: 'redis-caching',
    description: 'Redis caching strategies, rate limiting, pub/sub messaging, and cache invalidation.',
    content: `# Redis Caching Skill\n\n## Guidelines\n1. **TTL Expiration**: Always set a Time-To-Live (TTL) on cached items to prevent memory bloat.\n2. **Key Namespacing**: Use structured key names with colons (e.g. \`user:100:profile\`).\n3. **Cache Invalidation**: Invalidate or update relevant cache keys on data mutation.\n4. **Connection Resilience**: Handle connection errors gracefully without breaking core application flow.\n5. **Atomic Operations**: Use Redis transactions (\`MULTI\`/\`EXEC\`) or Lua scripts for atomic updates.`
  },
  {
    name: 'orm-database-mapping',
    description: 'Prisma, Drizzle ORM, TypeORM schema setup, relations, and type-safe data access.',
    content: `# ORM Database Mapping Skill\n\n## Guidelines\n1. **Type Safety**: Leverage ORM type generation for end-to-end type safety.\n2. **Explicit Migrations**: Use versioned database migrations rather than auto-syncing schemas in production.\n3. **Relation Loading**: Select only required fields rather than pulling full object graphs.\n4. **Connection Lifecycle**: Manage singleton ORM client instances across serverless executions.\n5. **Raw Queries**: Fall back to raw SQL when complex queries cannot be optimized by ORM abstraction.`
  },
  {
    name: 'code-review-checklist',
    description: 'Comprehensive code review guidelines covering safety, performance, and readability.',
    content: `# Code Review Checklist Skill\n\n## Guidelines\n1. **Correctness**: Does the code fulfill requirements and cover edge cases?\n2. **Security**: Are inputs validated? Are secrets protected? Is authorization checked?\n3. **Performance**: Are there unindexed queries, blocking loop operations, or memory leaks?\n4. **Readability**: Is the code clean, modular, well-named, and properly typed?\n5. **Testability**: Are there tests covering key logic paths?`
  },
  {
    name: 'clean-architecture-hexagonal',
    description: 'Clean architecture, domain-driven design, separation of concerns, and ports & adapters.',
    content: `# Clean Architecture Skill\n\n## Guidelines\n1. **Independence of Frameworks**: Business logic must not depend on UI or web framework details.\n2. **Domain Model**: Keep core business rules isolated inside entity objects.\n3. **Use Cases**: Encapsulate application workflow logic inside dedicated use-case services.\n4. **Interface Segregation**: Define interfaces (ports) for repositories and external services.\n5. **Dependency Rule**: Dependencies only point inwards towards domain concepts.`
  },
  {
    name: 'input-validation-sanitization',
    description: 'Input validation schemas using Zod/Joi, sanitization, and request payload checks.',
    content: `# Input Validation & Sanitization Skill\n\n## Guidelines\n1. **Schema Validation**: Validate all incoming HTTP payloads, query params, and route params using Zod.\n2. **String Trimming**: Trim whitespace and normalize strings prior to database storage.\n3. **Type Coercion**: Safely coerce strings to numbers or dates with fallback checks.\n4. **Sanitize HTML**: Strip dangerous HTML tags and scripts using DOMPurify or sanitize-html.\n5. **Clear Error Messages**: Return precise validation error messages mapping to failed fields.`
  },
  {
    name: 'websocket-realtime',
    description: 'WebSockets, Socket.io, real-time messaging, reconnection logic, and event broadcasting.',
    content: `# WebSocket Realtime Skill\n\n## Guidelines\n1. **Connection Auth**: Authenticate socket connections using tokens on initial handshake.\n2. **Auto Reconnection**: Implement exponential backoff reconnection logic on client disconnects.\n3. **Heartbeat Pings**: Send ping/pong frames to detect broken sockets promptly.\n4. **Room Namespacing**: Organize subscribers into rooms/channels for targeted message broadcasting.\n5. **Scaling**: Use Redis Adapter for multi-instance socket broadcasting.`
  },
  {
    name: 'microservices-architecture',
    description: 'Microservices architecture, message brokers (RabbitMQ/Kafka), and service communication.',
    content: `# Microservices Architecture Skill\n\n## Guidelines\n1. **Loose Coupling**: Ensure services own their databases and communicate via APIs or message queues.\n2. **Idempotency**: Ensure consumer handlers are idempotent to process duplicate messages safely.\n3. **Circuit Breaker**: Implement circuit breakers to fail fast when downstream services are down.\n4. **Distributed Tracing**: Pass trace headers (e.g. \`X-Trace-Id\`) across service boundaries.\n5. **API Gateway**: Route client requests through a centralized API gateway.`
  },
  {
    name: 'react-nextjs-expert',
    description: 'React 19, Next.js App Router, Server Components, SSG/SSR, and performance optimization.',
    content: `# React & Next.js Expert Skill\n\n## Guidelines\n1. **Server vs Client**: Use Server Components by default; add \`'use client'\` only when interactivity is needed.\n2. **Data Fetching**: Fetch data in Server Components or use React Query / SWR on client.\n3. **Image Optimization**: Use Next.js \`<Image />\` component for responsive images.\n4. **Route Handlers**: Implement clean API routes in \`app/api/route.ts\`.\n5. **Layouts & Suspense**: Use Suspense boundaries for streaming UI and loading states.`
  },
  {
    name: 'vue-nuxt-expert',
    description: 'Vue 3, Nuxt 3, Composition API, Script Setup, Pinia state, and SSR optimization.',
    content: `# Vue & Nuxt Expert Skill\n\n## Guidelines\n1. **Composition API**: Use \`<script setup>\` syntax with \`ref\` and \`reactive\` for clean state management.\n2. **Nuxt Data Fetching**: Use \`useFetch\` and \`useAsyncData\` to avoid duplicate client/server requests.\n3. **Pinia Stores**: Organize application state inside modular Pinia stores.\n4. **Auto-Imports**: Utilize Nuxt auto-imports for components, composables, and Vue APIs.\n5. **SEO & Meta**: Set reactive meta tags using \`useSeoMeta\` and \`useHead\`.`
  },
  {
    name: 'tailwind-design-system',
    description: 'Tailwind CSS utility styling, design tokens, dark mode, responsive design, and component patterns.',
    content: `# Tailwind CSS Design System Skill\n\n## Guidelines\n1. **Curated Color Palette**: Use cohesive Tailwind colors (slate, indigo, emerald) with proper contrast.\n2. **Dark Mode Support**: Leverage Tailwind \`dark:\` variant classes for dark mode.\n3. **Reusable Components**: Extract recurring utility patterns into clean UI component functions.\n4. **Responsive Classes**: Mobile-first design using \`sm:\`, \`md:\`, \`lg:\`, \`xl:\` breakpoints.\n5. **JIT Compilation**: Maintain clean \`tailwind.config.js\` and avoid arbitrary values when tokens exist.`
  },
  {
    name: 'seo-optimization',
    description: 'SEO best practices, meta tags, OpenGraph tags, semantic HTML, and Core Web Vitals.',
    content: `# SEO Optimization Skill\n\n## Guidelines\n1. **Meta Descriptions & Titles**: Provide unique, descriptive title tags and meta descriptions per page.\n2. **OpenGraph & Social Tags**: Add \`og:title\`, \`og:description\`, \`og:image\`, and \`twitter:card\` tags.\n3. **Single H1 Tag**: Ensure exactly one \`<h1>\` tag per page with structured heading hierarchy.\n4. **Semantic HTML**: Use \`<header>\`, \`<nav>\`, \`<main>\`, \`<article>\`, \`<aside>\`, \`<footer>\` tags.\n5. **Fast Load Times**: Optimize images, fonts, and scripts to excel at Core Web Vitals.`
  },
  {
    name: 'i18n-localization',
    description: 'Multi-language internationalization (i18n), translation key management, and locale formatting.',
    content: `# Internationalization (i18n) Skill\n\n## Guidelines\n1. **Key-Based Translation**: Never hardcode user-facing strings; use key paths (e.g. \`common.submit\`).\n2. **Pluralization & Interpolation**: Use i18n libraries for plural forms and parameter interpolation.\n3. **Locale Number & Date Formatting**: Use native \`Intl.DateTimeFormat\` and \`Intl.NumberFormat\`.\n4. **RTL Support**: Design CSS layouts to accommodate Right-To-Left languages when required.\n5. **Fallback Language**: Set a reliable fallback locale (e.g. \`uz\` or \`en\`) if key is missing.`
  },
  {
    name: 'state-management',
    description: 'Client-side state management patterns, Zustand, Redux Toolkit, and optimistic UI updates.',
    content: `# State Management Skill\n\n## Guidelines\n1. **Local vs Global**: Keep transient component state local; elevate to global store only when shared.\n2. **Immutability**: Avoid mutating state objects directly; return new copies or use Immer.\n3. **Optimistic Updates**: Update UI immediately on user action and rollback on server error.\n4. **State Normalization**: Normalize complex nested objects by ID to avoid duplicate data.\n5. **Selectors**: Use memoized selectors to prevent unnecessary re-renders.`
  },
  {
    name: 'dependency-injection',
    description: 'Dependency Injection (DI) and Inversion of Control (IoC) in TypeScript/Node.js apps.',
    content: `# Dependency Injection Skill\n\n## Guidelines\n1. **Constructor Injection**: Pass dependent services into constructors rather than importing singletons.\n2. **Interface Abstraction**: Depend upon interfaces/abstract classes rather than concrete implementations.\n3. **Easier Mocking**: DI allows effortless swapping of real database repositories with in-memory mocks.\n4. **IoC Containers**: Use lightweight IoC containers (e.g. Awilix, TSyringe) for complex object graphs.\n5. **Lifecycle Management**: Define singleton vs transient lifetimes clearly.`
  },
  {
    name: 'api-rate-limiting',
    description: 'Rate limiting strategies (token bucket, sliding window), middleware, and status headers.',
    content: `# API Rate Limiting Skill\n\n## Guidelines\n1. **Sliding Window**: Implement sliding window counter for precise rate limiting.\n2. **Identification**: Rate limit by IP address, user ID, or API token.\n3. **Standard Headers**: Return \`RateLimit-Limit\`, \`RateLimit-Remaining\`, and \`RateLimit-Reset\` headers.\n4. **429 Too Many Requests**: Return status \`429\` with a human-readable retry message when limit is exceeded.\n5. **Distributed Storage**: Use Redis for rate limit counters across multiple server nodes.`
  },
  {
    name: 'data-structures-algorithms',
    description: 'Data structure selection, algorithm efficiency, Big-O time/space complexity optimization.',
    content: `# Data Structures & Algorithms Skill\n\n## Guidelines\n1. **Map / Set Lookups**: Use \`Set\` and \`Map\` for O(1) membership checks and key lookups over \`Array.includes()\`. \n2. **Sorting Efficiency**: Use native \`Array.prototype.sort()\` with explicit comparator functions.\n3. **Avoid Nested Loops**: Replace O(n^2) nested loop array scans with single-pass hash map index lookups.\n4. **Queue vs Array Shift**: Avoid \`array.shift()\` inside loops (O(n)); use queue data structures.\n5. **Space Complexity**: Mind memory footprint when working with large dataset transformations.`
  },
  {
    name: 'mobile-responsive-design',
    description: 'Mobile-first responsive web design, touch targets, viewports, and CSS media queries.',
    content: `# Mobile Responsive Design Skill\n\n## Guidelines\n1. **Mobile-First Layout**: Write CSS mobile styles first, then expand layout via \`@media (min-width: ...)\`.\n2. **Touch Target Size**: Ensure interactive buttons and links have at least 44x44px touch area.\n3. **Viewport Meta**: Include \`<meta name="viewport" content="width=device-width, initial-scale=1.0">\`.\n4. **Flexible Images**: Set \`max-width: 100%; height: auto;\` on images to prevent layout overflow.\n5. **Test Screen Sizes**: Verify UI across mobile (375px), tablet (768px), and desktop (1440px) breakpoints.`
  },
  {
    name: 'accessibility-a11y',
    description: 'Web accessibility (a11y), ARIA labels, keyboard navigation, and screen reader support.',
    content: `# Web Accessibility (a11y) Skill\n\n## Guidelines\n1. **Keyboard Navigation**: Ensure all interactive elements are focusable and usable via \`Tab\` and \`Enter\`.\n2. **ARIA Attributes**: Use \`aria-label\`, \`aria-expanded\`, \`aria-hidden\` for custom UI controls.\n3. **Color Contrast**: Ensure text contrast meets WCAG AA standards (at least 4.5:1 ratio).\n4. **Alt Text**: Provide descriptive \`alt\` text for images.\n5. **Form Labels**: Pair every form input with an explicit \`<label for="...">\` attribute.`
  },
  {
    name: 'memory-leak-debugging',
    description: 'Heap snapshot inspection, memory leak identification, garbage collection, and cleanup.',
    content: `# Memory Leak Debugging Skill\n\n## Guidelines\n1. **Identify Unbounded Arrays**: Watch out for growing global arrays, caches, or event listeners.\n2. **Clear Intervals & Timeouts**: Always call \`clearInterval()\` and \`clearTimeout()\` when jobs complete.\n3. **Remove Event Listeners**: Call \`emitter.removeListener()\` or use \`AbortController\`.\n4. **Heap Snapshots**: Take heap snapshots before and after operations using Chrome DevTools or Node inspector.\n5. **WeakMap & WeakSet**: Use \`WeakMap\`/\`WeakSet\` for object metadata caching to allow garbage collection.`
  },
  {
    name: 'cli-tool-development',
    description: 'Building CLI utilities with Node.js, Commander/Yargs, interactive prompts, and terminal styling.',
    content: `# CLI Tool Development Skill\n\n## Guidelines\n1. **Executable Shebang**: Add \`#!/usr/bin/env node\` at top of CLI entry points.\n2. **Clean Argument Parsing**: Use Commander or Yargs to parse flags (\`--help\`, \`--version\`, \`-v\`).\n3. **Interactive Prompts**: Use Inquirer or Enquirer for interactive multi-choice prompts.\n4. **Terminal Styling**: Format output cleanly using Chalk/Picocolors and spinners (Ora).\n5. **Exit Codes**: Exit with code \`0\` on success and non-zero (e.g. \`1\`) on execution failures.`
  },
  {
    name: 'regex-pattern-matching',
    description: 'Regular expression optimization, input validation patterns, and safe regex usage.',
    content: `# Regex Pattern Matching Skill\n\n## Guidelines\n1. **Avoid Catastrophic Backtracking**: Test regex patterns against long inputs to prevent ReDoS vulnerability.\n2. **Anchoring**: Use \`^\` and \`$\` to anchor regex patterns when validating full string formats.\n3. **Named Capture Groups**: Use \`(?<name>pattern)\` for self-documenting Regex group extractions.\n4. **RegExp Compilation**: Pre-compile \`new RegExp()\` instances outside hot execution loops.\n5. **Test Utility**: Use Regex101 to verify regex patterns against diverse test strings.`
  },
  {
    name: 'fullstack-debugging',
    description: 'Systematic fullstack debugging techniques, root cause analysis, stack traces, and log inspection.',
    content: `# Fullstack Debugging Skill\n\n## Guidelines\n1. **Read Log Traces First**: Never guess root causes; read exact error messages and line numbers.\n2. **Isolate Component**: Determine whether failure occurs in frontend UI, HTTP network layer, or database.\n3. **Minimal Reproducible Example**: Isolate failing logic into a minimal test case.\n4. **Inspect Data Types**: Log \`typeof\` and \`JSON.stringify()\` to catch type mismatches.\n5. **Verify Fix**: Run automated tests and build commands to confirm bug resolution.`
  }
];

const targetBaseDir = path.join(__dirname, '.agents', 'skills');

skills.forEach(skill => {
  const dir = path.join(targetBaseDir, skill.name);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, 'SKILL.md');
  const fileContent = `---
name: ${skill.name}
description: ${skill.description}
---

${skill.content}
`;
  fs.writeFileSync(filePath, fileContent, 'utf-8');
  console.log(`Created skill: ${skill.name}`);
});

console.log('All skills successfully created!');
