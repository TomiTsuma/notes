# ChatMessage

A chat turn: user messages are right-aligned bubbles; assistant messages are open text with a "Thought for Ns" disclosure, streaming caret and actions (Insert into note, copy, 👍/👎, regenerate).

## Props

`role` user|assistant · `thought` · `streaming` · `actions` · children (rendered markdown).

## Usage

- Assistant text is never in a bubble — it reads like a document.
- "Insert into note" writes the answer into the active note.
