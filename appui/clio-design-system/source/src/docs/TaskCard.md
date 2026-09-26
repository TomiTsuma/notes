# TaskCard

Kanban card: key, priority, title, two-line description, project and due date; draggable.

## Props

`id` · `title` · `description` · `priority` · `due` · `dueState` soon|late · `project` · `projectColor` · `dragging` · `onOpen`.

## Usage

- Click opens the task detail modal (see TaskDetailPage).
- While dragging: `shadow-lift` + 2° tilt; the target column gets `over`.
