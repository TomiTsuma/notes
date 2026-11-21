# Changelog: project reading lists and the `papers` MCP tools

**Branch:** `feat/auth-gate`. **Request:** "use the Chlio MCP server to add papers to the Ereuna project": Claude Desktop
searches paper databases, then adds the results to a reading list in Chlio.

## What was missing

Chlio had no reading list. The only paper data was a fixed `papers` array (three example entries used by the `@` reference
picker), with no project link, no UI and no MCP tool, so Claude could search databases but had nowhere to put the results.

## What changed

- **Data:** new synced collection `readingList` of `ReadingItem` (project, title, authors, year, venue, url, doi, arXiv id,
  abstract, source database, tags, notes, status `to-read|reading|read`, added date). Added to the persisted snapshot,
  the server's key whitelist (`server/bootstrap.js`) and the three-way merge (`src/utils/stateMerge.ts`), so papers Claude
  adds while the browser has unsaved edits are merged, not overwritten. Deleting a project un-assigns its papers (keeps them).
- **MCP group `papers`** (4 tools; `paper_add`, `paper_update`, `paper_remove` are write tools and hidden from read-only tokens):
  - `paper_add(project, papers[≤50], status?)`: project by name (case-insensitive, unique part of the name is enough) or id.
    DOI and arXiv ids are normalised (URL prefix, case, `vN` stripped). **Duplicates on the same project are skipped** (same DOI,
    arXiv id or title), so re-running a search is safe; the same paper may be on two projects. Unknown or ambiguous
    projects fail with the list of projects, and nothing is saved.
  - `papers_list(project?, status?, query?, limit?)`, `paper_update(paper_id, status?, notes?, tags?, project?)`, `paper_remove(paper_ids[])`.
  - `chlio_search` also searches the reading list.
  - Links are accepted only as http(s) (a `javascript:` link from a model can never become a clickable link).
- **UI:** "Reading list" section on the project page: status filter, click the status button to cycle To read / Reading / Read,
  link to the paper (URL, else DOI, else arXiv), abstract preview, notes, tags, remove.
- Tool count 26 -> 30.

## How it is meant to be used

Claude Desktop has no paper-database tools of its own; connect a search source (e.g. an arXiv / OpenAlex / PubMed / Semantic Scholar
MCP server, or let Claude use web search) next to Chlio, then ask: *"Find the 10 most relevant 2024-2026 papers on graph
tokenisation for molecule generation across arXiv and OpenAlex, and add them to the Ereuna reading list."* Chlio does not search
databases itself.

## Verification

- Server tests: 64 pass (new: a reading-list lifecycle test covering add by project name, ID normalisation, duplicate skipping across
  databases, filters, status/notes/move, search, failed calls leaving the state untouched, the 50-per-call limit, read-only token).
- `stateMerge` test for papers added remotely during a local edit. `tsc` clean.
