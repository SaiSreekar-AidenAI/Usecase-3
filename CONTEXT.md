# Resolve — AI Support Console

## What
Single-screen app for customer support agents to generate AI-powered responses.
Paste a user query → generate a response → edit → copy.

## Stack
- React 19 + TypeScript (Create React App)
- No external state libraries — useReducer + Context
- No CSS framework — plain CSS with custom properties (design tokens)
- Mock API layer (services/api.ts) with simulated delays
- Google Fonts: Inter (display/body), JetBrains Mono (code/responses)

## Features

### Core Workflow
- **Query Input** — auto-growing textarea for pasting customer queries
- **Custom Prompt Mode** — toggleable additional instructions for the AI (prompt engineering)
- **Generate / Regenerate / Clear** — action bar with contextual buttons
- **Response Panel** — editable generated response with one-click copy to clipboard
- **Loading State** — animated dot bouncing indicator during generation

### History
- **Conversation History** — sidebar list of past query/response pairs
- **Expandable Items** — click to expand and see full response + custom prompt used
- **Delete Individual** — trash icon on each expanded item to remove it
- **Clear All History** — button at top of history list to wipe everything
- **Time Ago Labels** — relative timestamps (just now, 5m ago, 2h ago, etc.)
- **Prompt Badge** — visual indicator when a custom prompt was used

### Appearance / Theming
- **3 Themes** — Midnight (dark violet), Dawn (warm light), Aurora (dark cyan/teal)
- **Theme Switcher** — dropdown in top-right corner with color swatches
- **Persistent Theme** — saved to localStorage, restored on page load (no flash)
- **Smooth Transitions** — 500ms cross-fade when switching themes

### Design System
- **Design Tokens** — CSS custom properties for colors, typography, spacing, radius, shadows
- **Glass Morphism** — translucent card backgrounds with subtle gradients
- **Ambient Glow** — radial gradient at top of main content area
- **Micro-Animations** — button hover lifts, spring-eased toggles, staggered fade-ins
- **Responsive** — sidebar collapses to slide-over drawer on mobile (<768px)

## Views
1. **Generate** (main) — query input, optional custom prompt, generate button, editable response
2. **History** (sidebar) — list of past conversations, expandable cards, delete/clear actions
