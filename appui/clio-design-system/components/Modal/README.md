# Modal

Dialog on a scrim with title, description, body and a footer of actions.

## Props

`title` · `description` · children · `footer` · `onClose` · `width` · `inline` (renders the scrim).

## Usage

- Destructive action sits bottom-left (`className="left"`), Cancel + primary on the right.
- Replaces every browser `prompt()`/`confirm()` (rename, delete).
