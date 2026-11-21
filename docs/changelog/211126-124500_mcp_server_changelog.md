# Changelog: MCP server, safe state sync, live refresh

**Branch:** `feat/auth-gate` (second commit). **Builds on:** `211126-110844_auth_gate_changelog.md` (access tokens).
**Why:** drive Chlio (mind maps, planner, notes, Jira) from Claude Desktop, Claude Code and Open WebUI.

## The problem that had to be solved first

The browser holds the whole app state in memory and saves **all of it** 2 seconds after any change, with no
version check and no refresh from the server. A second writer therefore had two bad options: its edits were
invisible until a page reload, and the next browser save silently erased them. Any MCP server built on that would
have lost data. So:

1. **Revision + `If-Match` (server).** `app_state.revision` (migrated in place, additive; the previous image
   ignores it). `GET /api/bootstrap` returns `revision` + `ETag`. `PUT /api/bootstrap` requires
   `If-Match: "<revision>"`: **428** if missing, **409** (with the current state) if stale. A refused save deletes
   nothing (uploaded-file cleanup runs only after the check). `GET /api/bootstrap/revision` is a cheap poll target.
2. **Three-way merge (browser).** `src/utils/stateMerge.ts`: base (last synced) / local (unsaved edits) / remote
   (server now), per item by id. Only one side changed -> that side. Both changed -> field merge for mind-map
   nodes/edges and notebook text, otherwise the local edit wins. Delete vs edit keeps the edit. `useStoreSync`
   merges on 409 and retries, and polls the revision every 8 s (and on tab focus / reconnect), applying other
   writers' changes live.
3. **Atomic server writes.** `mutateState(fn)` (`server/stateStore.js`): read-modify-write in one SQLite
   transaction, bumps the revision, rolls back completely if `fn` throws.

## The MCP server (`server/mcp/`, route `POST /mcp`)

- Streamable HTTP, **stateless, JSON responses** (no SSE; works through Cloudflare). MCP SDK 1.32.2.
- **Access tokens only.** A browser session cookie is refused on `/mcp` (CSRF / DNS-rebinding), a foreign `Origin`
  is refused, failed attempts are rate-limited. A read-only token is not offered the write tools at all.
- **26 tools in 5 opt-in groups**, selected with `/mcp?groups=mindmaps,planner,notes,jira,search` (default all).
  Measured schema cost: all ~4.2k tokens; mindmaps ~1.7k, planner ~1.4k, notes ~0.4k, jira ~0.6k, search ~0.15k.

| Group | Tools |
|---|---|
| mindmaps (9) | `mindmap_list`, `mindmap_get`, `mindmap_create`, `mindmap_add_nodes`, `mindmap_update_node`, `mindmap_connect`, `mindmap_delete_nodes`, `mindmap_relayout`, `mindmap_delete_board` |
| planner (9) | `projects_list`, `project_create`, `tasks_list`, `task_create`, `task_update`, `task_delete`, `events_list`, `event_create` (optionally into Google Calendar), `event_delete` |
| notes (3) | `notes_list`, `note_read`, `note_create` (typed notebook, same shape the app uses) |
| jira (4) | `jira_issues`, `jira_create_issue`, `jira_transition`, `jira_comment` |
| search (1) | `chlio_search` |

- **Mind maps from an outline.** Models are bad at coordinates, so `mindmap_create` takes an indented outline
  (`- Title | note`, nested by indentation) and the server lays it out and colours the branches.
  `mindmap_add_nodes` places new nodes beside their parent without disturbing hand-arranged layouts.
  Cycles, second parents and self-links are kept as "cross-links" (see bugs below).
- **Edge geometry matches the app.** The app attaches an edge to a node's side only when |dx| >= |dy| between
  centres, otherwise top/bottom, which made fan-out trees look like tangled curves. Column gaps are now
  adaptive so every tree edge goes side to side (asserted by tests, checked in a screenshot).
- Destructive tools are annotated; `mindmap_delete_board` needs `confirm: true`.

## Bugs found by the tests (all fixed)

| Found by | Bug |
|---|---|
| unit test | Outline ids (`[mm-...]`) stayed in titles when a note followed them |
| integration test | A link from a node back to an ancestor made the whole tree vanish from the outline and layout (every node in the loop looked like a child). Now a spanning tree: first parent wins, loop-closing edges become cross-links |
| image e2e | The Dockerfile copied `server/*.js` but not `server/mcp/`, so the image could not start |
| browser e2e | Fan-out trees drew top/bottom swoops (adaptive columns, above) |
| test review | A router-wide body parser would have capped every `/api` body at 16 KB (fixed earlier, in the auth work) |

## Verification

- 52 server tests (`cd server && npm test` in node:20): auth, mind-map logic, every tool through the **real MCP client**
  over HTTP, atomic rollback, revision / If-Match contract, file-blob safety on refused saves.
- 12 merge tests incl. a 300-case randomised property test (`node --test src/utils/stateMerge.test.ts`).
- 71 end-to-end checks against the built image (fake credentials, throwaway volume).
- 19 MCP checks from a separate machine over the network (real SDK client).
- 11 real-browser checks (Edge): the MCP board renders; an MCP edit appears in the open page in ~3 s without reload;
  a local edit and a simultaneous MCP write both survive (the browser saw 409 then 200); a typed note opens in
  the notebook editor.
- **Claude Desktop path:** the `mcp-remote` bridge (stdio to HTTP): initialize, list, read and write all work.
  On Windows keep spaces out of the `--header` argument and pass the value through `env` (see README).
- **Not tested live:** the Jira tools (thin wrappers over the existing client, tested with a fake), Google Calendar
  creation (fake), and a real Claude Desktop / Open WebUI session.

## Compatibility / rollout notes

- Browser tabs running the previous bundle get **428** on save until reloaded (the old client sends no `If-Match`).
- Rolling back to the previous image is safe: the `revision` column is additive.
- Handwriting/pen strokes and PDF contents are not exposed. The arXiv lookup/BibTeX routes are not tools yet.
