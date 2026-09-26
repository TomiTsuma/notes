# Button

The text button: one `primary` per view, `secondary` for everything else, `ghost` inside toolbars, `ai` only for Clio AI entry points, `danger` for destructive actions.

## Props

`variant` primary | secondary | ghost | ai | danger · `size` md (36px) | sm (28px) · `icon`, `iconRight` (icon names) · `block` · any `<button>` attribute.

## Usage

- Label with a verb in sentence case: "New task", "Import arXiv paper", "Save changes".
- Never two `primary` buttons in one view or modal footer.
- Replaces: `.btn-animate` buttons, the Kanban "New Task", Dashboard "Create New Project", modal Save/Cancel, Nextcloud "Download & Save".
