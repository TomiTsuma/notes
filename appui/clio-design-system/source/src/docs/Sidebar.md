# Sidebar

The app’s left rail: logo, ⌘K search, the six workspace views, projects, the notebook file tree, tags and a footer with Nextcloud sync status and the user card.

## Props

`activeView` · `projects` [{id,name,color,count}] · `tree` (nested {id,type,name,children,open}) · `tags` [{name,color}] · `activeFileId` · `sync` connected|connecting|failed|idle · `logoLight`/`logoDark` · `counts` · `onNavigate`. Also exports `NavItem`, `NavSection`, `TreeItem`, `VIEWS`.

## Usage

- Keeps every old sidebar feature: views, projects + create, file/folder upload, new folder, right-click menu (use `Menu`), tag filter, Nextcloud status.
- Nextcloud credentials move out of the sidebar into Settings (`ConnectionForm` in a `Modal`); the footer shows status and opens it.
- Width `sidebar-width`; below 1000px it becomes a drawer over `overlay-scrim`.
