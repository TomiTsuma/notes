# ToolDock

Floating bottom dock of physical-looking tools (pen, pencil, highlighter, eraser, ruler, text, sticky, select) plus add page, undo, redo and clear.

## Props

`active` · `color` (pen-* token) · `tools` · `onSelect` · `onUndo` · `onRedo`. Exports `TOOLS`.

## Usage

- The active tool lifts out of the dock; tapping it again opens ToolPopover.
- Replaces ToolPalette + FloatingToolbar.
