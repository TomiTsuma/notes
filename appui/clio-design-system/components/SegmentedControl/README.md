# SegmentedControl

A pill track of 2–4 mutually exclusive options: calendar Day/Week/Month, AI Chat/Smart notes, grid/list.

## Props

`options` [{value,label,icon?}] · `value` + `onChange` (controlled) or uncontrolled · `iconOnly`.

## Usage

- Keep labels to one word.
- Not for navigation between views — that is the Sidebar.
- Replaces `.apple-segmented-control`.
