Clio is a quiet research notebook. Papers, handwriting, tasks and an AI that reads along with you all sit on warm paper, with pastel folders to keep them sorted. The interface should feel like a well-kept desk: calm neutrals, one strong ink colour for actions, colour only where it helps you sort things, and serif type wherever you are *reading*.

The design draws on seven references: pastel note groups, a supernotes-style daily card, a task board with status pills, a project grid and list, a stat and streak card family, a soft AI side panel, and a pen dock like Windows Ink. It keeps every existing Clio feature. Only the surface changes.

## Principles

1. **Paper first.** Every ground is a warm neutral (`surface`, `surface-sidebar`, `surface-raised`). Colour sorts things and is never decoration.
2. **One ink for actions.** The only strong fill is `primary` (ink-black in Paper, paper-white in Graphite). Use one per view: New task, New note, Create project, Send.
3. **Tints mean something.** The six pastel families (rose, sky, sage, amber, lilac, stone) label projects, statuses, priorities and tags. The same meaning holds on every screen (see *Colour roles*).
4. **Read in serif, operate in sans.** Note titles, note bodies, smart notes and long AI answers use Newsreader. Everything you click uses Figtree.
5. **The AI is a guest.** Clio AI lives in its own panel on a flat lilac wash (`ai-wash`) and marks its words with `ai-ink`. It never takes over the workspace, and it never uses a gradient.

## Content fundamentals

- **Voice:** a helpful lab-mate. Speak plainly and specifically, and never cheer. Say "3 tasks due today · 2 papers waiting to be read", not "You're crushing it! 🎉".
- **Casing:** sentence case everywhere: buttons, headings, labels, menu items. The only uppercase is the `overline` style for sidebar and panel sections (WORKSPACE, PROJECTS). The old ALL-CAPS form labels ("PROJECT NAME") are retired.
- **Person:** say "you" to the user, and let the product call itself "Clio" ("Ask Clio", "Clio AI"). Avoid "we".
- **Verbs on buttons:** New task, Import arXiv paper, Save changes, Link to project. No "OK" or "Submit".
- **Numbers and ids:** set task keys (`CLIO-28`), arXiv ids (`2512.02667`), times (`14:30`) and paths in `mono`. Write dates as `Sep 25` in meta and `2026-09-25` as a daily card title.
- **Emoji:** never in the UI. Users may put emoji in their own tags and notes, and those render as typed.
- **Empty states:** one sentence saying what goes here and one action: "Create a project first, then add tasks to track your research from idea to done."
- **Errors:** say what happened and what Clio did about it: "Nextcloud returned 401. Uploads are queued on this device."

## Visual foundations

### Colour roles

| Role | Tokens | Where |
|---|---|---|
| Grounds | `canvas` › `surface-sidebar` › `surface` › `surface-raised`, `surface-inset` | window gutter › rails › views › cards › fields |
| Text | `ink`, `ink-2`, `ink-3`, `ink-inverse` | body › secondary › meta/placeholder › on `primary` |
| Action | `primary`, `primary-hover` | the one strong button per view, send, counts |
| Accent | `accent`, `accent-soft`, `focus-ring` | links, focus, selection, active chart bar, @context chips. Never a large fill |
| Tints | `<tint>-wash`, `-tint`, `-edge`, `-ink`, `-solid` | wash = containers, tint = chips, ink = text on both, solid = dots/bars/rails |
| AI | `ai-wash`, `ai-ink` | the Clio AI panel and its marks only |
| Paper | `paper`, `paper-rule`, `paper-margin`, `highlight`, `marker-yellow` | canvas pages and highlighter |
| Inks | `pen-black` … `pen-violet` | stroke colours in the tool palette (stored with strokes) |

**Tint meanings:** stone = Not started / unsorted; amber = In progress, Medium priority, due soon, the streak flame; lilac = Under review and AI; sage = Completed, positive deltas, done streak days; rose = High priority, meetings/personal; sky = the default project tint, events, Low priority. Projects pick any of the six. Status and priority always show an icon and a word too, so colour is never the only signal.

**Contrast:** every text token clears 4.5:1 on the grounds its usage note names, in both themes. `line-strong`, the focus ring, `accent` and the active chart bar clear 3:1. `-solid` tints are for non-text marks only.

### Type

- Figtree (sans) for the interface: `display` 34/40 page titles, `title-lg` 22/28 sections, `title` 17/24 card titles, `body` 14/21, `body-strong`, `body-sm` 13/18 meta, `label` 12/16 chips, `overline` 11/14 uppercase.
- Newsreader (serif) for reading: `note-title` 24/30, `note-body` 16/26.
- JetBrains Mono for `mono` 12/16: ids, times, paths, keyboard hints.
- Use tabular figures for stats, calendars and times.

### Space, radius, elevation

- A 4px grid: `space-1` 4 … `space-12` 48. Views pad `space-10` on desktop and `space-8` on tablet. Card grids gap `space-4`.
- Radii grow with the size of the thing: chips `radius-xs` 6, controls `radius-sm` 8, cards `radius-md` 12, containers, columns and panels `radius-lg` 18, the window and composer `radius-xl` 24, avatars and bubbles `radius-pill`.
- Borders do most of the separating: 1px `line` on every card. Shadows are quiet. `shadow-card` for resting cards, `shadow-float` for the dock, menus and composer, `shadow-lift` + a 2° tilt only while dragging, `shadow-window` for modals.
- The layout is fixed chrome: `sidebar-width` 256, `topbar-height` 56, `panel-width` 380 (resizable 320–560). Below 1000px the sidebar becomes a drawer. Touch targets on tablet are at least `hit-target` 44px.

### Motion

- Views cross-fade and rise 14px over 380ms with `cubic-bezier(.16,1,.3,1)`. Hovers take 150ms. Drag lift takes 180ms.
- The active pen rises out of the dock. Recording pulses. AI loading shimmers in lilac. Nothing bounces.
- Honour `prefers-reduced-motion` by turning all of it off.

### States

- Hover uses `surface-hover`. Selected nav and rows use `surface-selected` + weight 600.
- Focus is a 2px solid `focus-ring` offset by 2px on every interactive element.
- Disabled is 45% opacity with a not-allowed cursor. Drop targets get an `accent` border on `accent-soft`.

### Imagery and backgrounds

The Dashboard may show the user's rotating wallpaper behind the window, on `canvas`. The window itself stays opaque paper. The old frosted glass is gone because it hurt contrast. Paper thumbnails are drawn, never screenshots.

## Layout — the app shell

`Window` = `Sidebar` | (`TopBar` + view) | optional `AIPanel`. Each view opens with a `ViewHeader` (optional overline, `display` title, one-line subtitle, actions on the right). Sections below it use `SectionHeader`. The eight showcase pages (Dashboard, Project Hub, Project detail, Kanban, Task detail, Calendar, Library, Note Canvas) show every current feature in the new system.

### Feature map (old → new)

| Old | New |
|---|---|
| Sidebar branched menu, projects, notebooks tree, tags, Nextcloud form | `Sidebar` (views, projects, tree with upload/new folder, tags). Nextcloud settings move to `ConnectionForm` in a `Modal` opened from the footer |
| DocumentHeader + ThemeToggle | `TopBar` (breadcrumb, record, download, theme, Ask Clio) |
| RightPanel (chat + smart notes) | `AIPanel`, `ChatMessage`, `Composer`, `SmartNote` |
| HomeDashboard streak, agenda, quick tools, daily todos, projects, notebooks | `StreakCard`, `AgendaItem`, `QuickActions`, `DailyCard`, `ProjectCard`, `NoteCard` |
| ProjectsSection | Project Hub (`ProjectCard`/`ProjectRow`) + Project detail |
| KanbanBoard + TaskDetailModal | `KanbanColumn`, `TaskCard`, `StatusPill`, `PriorityFlag`, `Modal` |
| CalendarView (day/week/month, event form, bottom sheet) | `SegmentedControl`, `MiniCalendar`, `EventBlock`, `Modal`, `.cl-sheet` |
| NextcloudLibrary, FolderFloat, sticky/notepad/arXiv/subfolder modals | `FolderCard`, `PaperCard`, `NoteCard`, `StickyNote`, `QuickActions`, `Modal` |
| ToolPalette, FloatingToolbar, CanvasTagBar, notebook pages | `ToolDock`, `ToolPopover`, `CanvasTagBar`, `NotebookPage` |
| `prompt()` / `confirm()` / `alert()` | `Modal`, `Menu`, `Banner` |

## Iconography

Clio uses its own line icon set, exported as `Icon` / `ICONS` in the bundle: a 24px grid, 1.7px stroke, round caps and joins, drawn in `currentColor`. Use 16px in chips and menus, 17–18px in nav and buttons, and 20px in section headers. Icons sit beside a word, and only icon buttons stand alone (always with a `label`). The pen dock is the one place for illustrated objects (pen, pencil, highlighter, eraser, ruler) so the tools read at a glance. No emoji, and no filled icon style except the starred ★.

## Logo

Use the wordmark from `assets/Logos`: `clio-wordmark-ink.png` in Paper and `clio-wordmark-paper.png` in Graphite, 22px tall in the sidebar. `Sidebar` swaps them by theme when you pass `logoLight`/`logoDark`.
