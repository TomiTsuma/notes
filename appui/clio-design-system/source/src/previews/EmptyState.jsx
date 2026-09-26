// @card group="Feedback" height=260
import { C, mount } from "./_mount.js";

mount(<C.EmptyState icon="kanban" title="No tasks yet" action={<C.Button variant="primary" icon="plus">New task</C.Button>}>Create a project first, then add tasks to track your research from idea to done.</C.EmptyState>);
