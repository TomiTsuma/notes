# TopBar

The 56px document header: back, breadcrumb, record, download, theme toggle and the "Ask Clio" toggle for the AI panel.

## Props

`crumbs` string[] (last = current) · `recording` · `showDownload` · `theme` + `onToggleTheme` · `panelOpen` + `onTogglePanel` · `sidebarOpen` · children (view-specific controls before the actions).

## Usage

- Recording shows a pulsing `danger` pill with the elapsed time.
- Theme toggle lives here in every view (replaces the floating ThemeToggle).
