# Local DB Manager — Professional UI Redesign

Redesign the UI of this application so it looks like a **real, production-grade developer tool**, not an AI-generated SaaS dashboard.

The application is a **local database environment manager**, similar in concept to Docker Desktop, but focused on managing local MySQL database environments.

## Primary Design Direction

Use the visual quality and design principles of modern developer applications such as:

- Linear
- Vercel
- Raycast
- Docker Desktop
- Supabase Dashboard
- GitHub Desktop
- Modern database clients

Do NOT copy any of these products directly. Use them only as design inspiration.

The result should feel:

- Professional
- Technical
- Minimal
- Trustworthy
- Developer-focused
- Dense enough to be useful
- Visually consistent
- Native to a desktop application
- Suitable for a serious portfolio project

Avoid making it look like a marketing website.

---

# 1. Remove the AI-generated visual patterns

The current interface has several characteristics that make it look AI-generated.

Remove or significantly reduce:

- Large marketing-style hero sections
- Excessive gradients
- Decorative glowing backgrounds
- Huge rounded cards
- Excessive shadows
- Excessive use of blue/purple gradients
- Large empty spaces
- Repeated card containers
- Giant headings
- Unnecessary illustrations
- Decorative background textures
- Overly colorful status cards
- Excessive pill-shaped UI elements
- Excessive rounded corners
- Large CTA buttons where a compact button would work better

The application should look like a **working developer utility**, not a landing page.

---

# 2. Overall Layout

Keep a permanent left sidebar.

Use approximately:

- Sidebar: 220–240px
- Main content: remaining width
- Main content max-width should NOT be unnecessarily constrained
- Use a consistent 24–32px page padding
- Use an 8px spacing system

The layout should feel compact and intentional.

Suggested structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ Application title / top bar                                 │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│  Workspace    │  Page header                                │
│               │  Description / actions                      │
│  Overview     │                                             │
│  Environments │  ┌───────────────────────────────────────┐  │
│  Activity     │  │ Environment content                   │  │
│               │  │                                       │  │
│               │  └───────────────────────────────────────┘  │
│               │                                             │
│               │                                             │
│  Settings     │                                             │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

The application should prioritize the database environments themselves rather than decorative dashboard statistics.

---

# 3. Color Palette

Use a restrained professional palette.

## Light theme

Background:

```text
#F7F8FA
```

Primary surface:

```text
#FFFFFF
```

Secondary surface:

```text
#F1F3F5
```

Borders:

```text
#E2E5E9
```

Primary text:

```text
#17191C
```

Secondary text:

```text
#68707A
```

Muted text:

```text
#9299A3
```

Primary accent:

```text
#2563EB
```

Hover accent:

```text
#1D4ED8
```

Success:

```text
#16A34A
```

Warning:

```text
#D97706
```

Error:

```text
#DC2626
```

Do not use gradients as the primary visual language.

Blue should be an accent, not the entire interface.

---

# 4. Dark Theme

The application is a developer tool, so dark mode should be treated as a first-class theme.

Use:

```text
Background: #0D1117
Surface: #161B22
Elevated surface: #1C2128
Border: #30363D
Primary text: #E6EDF3
Secondary text: #8B949E
Accent: #3B82F6
Success: #3FB950
Warning: #D29922
Error: #F85149
```

Avoid pure black and avoid excessive blue/purple backgrounds.

---

# 5. Typography

Use a modern UI font.

Preferred:

```text
Inter
```

If Inter is unavailable, use:

```text
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Typography should be hierarchical but compact.

Suggested sizes:

```text
Page title: 24–28px
Section title: 16–18px
Body: 14px
Secondary text: 13px
Metadata: 12px
```

Do not use extremely large headings.

Font weights should generally be:

```text
400 — normal
500 — medium
600 — semibold
```

Avoid excessive bold text.

---

# 6. Border Radius

Use restrained corner radii.

Suggested:

```text
Buttons: 6px
Inputs: 6px
Cards: 8px
Dialogs: 10px
Sidebar items: 6px
```

Do NOT use 16px, 20px, or 24px rounded cards everywhere.

The UI should have subtle structure rather than obvious "cardification."

---

# 7. Shadows

Use shadows sparingly.

Most surfaces should be separated using:

```text
1px solid border
```

rather than large shadows.

Only dialogs, dropdowns, and floating elements should have noticeable elevation.

---

# 8. Sidebar

Redesign the sidebar to look like a professional developer application.

Structure:

```text
Local DB Manager
─────────────────

WORKSPACE

Overview
Environments
Activity

─────────────────

Settings

─────────────────

MySQL workspace
Local database environments
```

Use simple line icons.

The selected navigation item should have:

- subtle blue background
- blue/white icon depending on theme
- clear text contrast

Do not use large gradients in the sidebar.

The sidebar should feel functional rather than decorative.

---

# 9. Overview Page

Completely redesign the current overview page.

Remove the large:

> "Build with confidence"

hero section.

Replace it with a compact page header:

```text
Overview

Manage your local database environments.

                              + New environment
```

Then show useful information.

For example:

```text
┌────────────────┬────────────────┬────────────────┐
│ Environments   │ Running        │ Stopped        │
│ 3              │ 2              │ 1              │
└────────────────┴────────────────┴────────────────┘
```

These should be compact statistic blocks, not giant decorative cards.

Then:

```text
Your environments

┌─────────────────────────────────────────────────────┐
│ ● Payments API                    Running            │
│   MySQL 8.4 · Port 3306                              │
│                                      Open   ⋯       │
├─────────────────────────────────────────────────────┤
│ ● Inventory Service               Stopped            │
│   MySQL 8.4 · Port 3307                              │
│                                      Start   ⋯       │
└─────────────────────────────────────────────────────┘
```

The environment list should become the main focus of the page.

---

# 10. Environment Cards

Environment cards should contain useful technical information.

Each environment should clearly show:

```text
Environment name
Database type
Database version
Container/service status
Port
Database name
Created/updated information
```

Example:

```text
Payments API
MySQL 8.4

● Running

localhost:3306
payments_dev

                         Connect     ⋯
```

Use status indicators:

```text
● Running
● Stopped
● Starting
● Error
```

Use color only for status communication.

Do not turn every piece of information into a colored badge.

---

# 11. New Environment Flow

The current "Create a MySQL environment" section looks like a form embedded inside a marketing dashboard.

Replace it with a proper application workflow.

Prefer a modal or dedicated page.

Example:

```text
Create environment

Environment name
[ Payments API                         ]

Database
[ MySQL ▼                              ]

Version
[ 8.4                                  ]

Database name
[ payments_dev                         ]

Port
[ 3306                                 ]

Root password
[ •••••••••                            ]

────────────────────────────────────────

Cancel                     Create environment
```

The form should be clean and compact.

Use clear labels above inputs.

Do not depend on browser-native validation popups for the primary experience. Implement proper inline validation.

---

# 12. Buttons

Buttons should be compact and functional.

Primary:

```text
+ New environment
Create environment
Start
Connect
```

Secondary:

```text
Cancel
Stop
Restart
View details
```

Destructive:

```text
Delete
```

Do not make every button blue.

Use:

- Primary = blue
- Secondary = neutral
- Destructive = red
- Ghost = transparent

Button height around 32–36px.

---

# 13. Tables / Lists

For database-related information, prefer tables and structured lists over cards when appropriate.

Example:

```text
Environment       Status      Version    Port      Actions
────────────────────────────────────────────────────────────
Payments API      Running     8.4        3306      ⋯
Inventory         Stopped     8.4        3307      ⋯
Analytics         Running     8.0        3308      ⋯
```

The UI should communicate technical information efficiently.

---

# 14. Activity Page

Create a clean developer-style activity feed.

Example:

```text
Activity

Today

● Payments API started
  MySQL 8.4 · 2 minutes ago

● Inventory stopped
  MySQL 8.4 · 18 minutes ago

● Payments API created
  1 hour ago
```

Use subtle timeline indicators.

Avoid giant cards.

---

# 15. Environment Details Page

The environment details page should be one of the strongest parts of the application.

Suggested layout:

```text
← Environments

Payments API
● Running

MySQL 8.4
localhost:3306

[Connect] [Restart] [Stop] [⋯]

────────────────────────────────────────────

Overview

Database
payments_dev

Host
localhost

Port
3306

Status
Running

────────────────────────────────────────────

Connection

mysql://root:••••@localhost:3306/payments_dev

[Copy]

────────────────────────────────────────────

Logs

────────────────────────────────────────────
2026-08-27 22:01:12 MySQL ready
2026-08-27 22:01:13 Connection accepted
```

This should feel like a real developer tool.

---

# 16. Icons

Use one consistent icon library throughout the application.

Prefer:

```text
Lucide
```

Use icons only where they improve recognition.

Do not place icons inside every single piece of text.

Avoid mixing multiple icon styles.

---

# 17. Micro-interactions

Add subtle interactions:

- Sidebar hover
- Button hover
- Row hover
- Start/stop loading states
- Status transitions
- Toast notifications
- Modal transitions
- Copy-to-clipboard feedback
- Skeleton loading where appropriate

Animations should be approximately:

```text
150–200ms
```

Avoid large animations or excessive motion.

---

# 18. Empty States

Empty states should be simple.

Instead of:

> giant illustration + giant card + large CTA

Use:

```text
No environments yet

Create a local MySQL environment to get started.

[ + New environment ]
```

Keep the empty state compact.

---

# 19. Forms and Inputs

Inputs should look like professional developer tooling.

Use:

- clear labels
- subtle borders
- 6px radius
- visible focus state
- consistent height
- inline validation
- helpful descriptions only when necessary

Focus state:

```text
border: #2563EB
```

Do not use browser-default styling.

---

# 20. Content Density

This is an important requirement.

Do NOT try to fill the page with decorative UI.

A database management application should prioritize:

```text
Information > Decoration
```

Users should be able to understand:

- What databases exist
- Which are running
- Which are stopped
- Which ports they use
- How to connect
- What errors occurred

within a few seconds.

---

# 21. Visual Hierarchy

Use this hierarchy:

```text
Application
    ↓
Page
    ↓
Section
    ↓
Environment
    ↓
Technical metadata
```

Not:

```text
Huge hero
    ↓
Huge cards
    ↓
More cards
    ↓
Decorative empty space
```

---

# 22. Important UX Principle

This is a **desktop database management application**, not a website.

Design decisions should therefore favor:

- efficiency
- information density
- keyboard-friendly interactions
- predictable navigation
- clear states
- technical information
- fast workflows

over:

- marketing aesthetics
- decorative gradients
- oversized typography
- excessive whitespace
- flashy animations

---

# 23. Preserve Existing Functionality

IMPORTANT:

This is primarily a UI/UX redesign.

Do NOT break existing functionality.

Before modifying components:

1. Inspect the existing project structure.
2. Identify the current routing/navigation.
3. Identify the existing database/environment logic.
4. Identify existing API/IPC calls.
5. Identify existing state management.
6. Identify existing reusable components.
7. Preserve all working functionality.
8. Only replace/refactor UI components where necessary.

Do not rewrite backend functionality simply to change the appearance.

Do not change database logic unless required for the UI to function correctly.

---

# 24. Component Architecture

Create reusable components rather than writing one huge page component.

For example:

```text
Layout
├── Sidebar
├── TopBar
└── PageContainer

UI
├── Button
├── Input
├── Select
├── Dialog
├── Dropdown
├── Badge
├── StatusIndicator
├── Toast
└── EmptyState

Database
├── EnvironmentList
├── EnvironmentRow
├── EnvironmentStatus
├── EnvironmentForm
├── ConnectionInfo
├── LogsViewer
└── EnvironmentActions
```

Keep components modular and reusable.

---

# 25. Responsive Behavior

The application is primarily desktop-oriented, but it should still handle smaller window sizes correctly.

At smaller widths:

- sidebar may collapse
- tables should remain usable
- actions should not overflow
- forms should stack appropriately
- content should not become cramped

Never allow horizontal overflow unless intentionally required for technical content such as logs.

---

# 26. Design Consistency

Create a small design system and use it consistently.

Define:

- colors
- spacing
- typography
- border radius
- shadows
- button sizes
- input sizes
- status colors
- transitions

Do not individually style every component with arbitrary values.

---

# 27. Final Visual Target

When finished, the application should visually communicate:

> "This is a serious local database development tool."

It should NOT communicate:

> "This is an AI-generated SaaS dashboard."

The final UI should look closer to a **professional developer desktop application** than a startup landing page.

Use restrained visual design, strong spacing, excellent typography, subtle borders, compact controls, and technically useful information.

Before finishing, review every page and remove anything that looks unnecessarily decorative, repetitive, oversized, or AI-generated.

Do not stop after redesigning the Overview page. Apply the same design system consistently across the entire application.