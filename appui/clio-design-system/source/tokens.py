import json

C = []  # (name, light, dark, usage)
def c(n, l, d, u): C.append((n, l, d, u))

# ---- Grounds
c("canvas", "#ebe6de", "#0f0e0d", "Outermost app ground behind the window: the wallpaper fallback and the gutter around floating panels.")
c("surface-sidebar", "#f5f2ec", "#161514", "Sidebar and right-panel ground. Nav text (`ink`, `ink-2`) reads on it.")
c("surface", "#faf8f4", "#1b1a18", "Main workspace ground for every view (Home, Projects, Kanban, Calendar, Library, Canvas chrome).")
c("surface-raised", "#ffffff", "#242220", "Cards, note cards, task cards, modals, menus, the composer. Body copy in `ink` sits on it.")
c("surface-inset", "#efebe4", "#2b2927", "Recessed fields: search, segmented-control tracks, text inputs, code blocks, the chat user bubble.")
c("surface-hover", "#ebe6dd", "#302e2b", "Hover fill for nav items, rows, icon buttons and menu items.")
c("surface-selected", "#e6e0d5", "#383531", "Selected nav item / active tree row fill. Always paired with `ink` text and weight 600.")
c("overlay-scrim", "rgba(31, 28, 24, 0.32)", "rgba(0, 0, 0, 0.56)", "Scrim behind modals, bottom sheets and the mobile sidebar drawer.")
# ---- Lines
c("line", "#e5e0d7", "#34312d", "Hairline dividers and card borders (1px). Never carries meaning on its own.")
c("line-strong", "#8f877b", "#767067", "Control borders that must be seen: inputs, checkboxes, dashed 'add' tiles. 3:1 on `surface` and `surface-raised`.")
# ---- Ink
c("ink", "#1f1c18", "#f3efe8", "Primary text and icons on every surface token (surface-sidebar/surface/surface-raised/surface-inset).")
c("ink-2", "#5c554c", "#bdb5aa", "Secondary text: descriptions, sidebar items at rest, meta lines. 4.5:1 on all surfaces.")
c("ink-3", "#736b60", "#9a9287", "Tertiary text: timestamps, placeholders, section overlines (MAIN, PROJECTS). 4.5:1 on surface and surface-raised.")
c("ink-inverse", "#ffffff", "#1b1a18", "Text/icons on `primary` fills (the ink button, the send button, count badges).")
# ---- Actions
c("primary", "#1f1c18", "#f3efe8", "The one strong action per view: New task, Create project, Send. Ink-black in light, paper in dark; text in `ink-inverse`.")
c("primary-hover", "#3a352e", "#d9d3c9", "Hover state of `primary` fills.")
c("accent", "#2b48c4", "#93a8ff", "Cobalt ink: links, focus rings, selection outlines, the active chart bar, the cursor in the canvas, @-mentions. Never a large fill.")
c("accent-soft", "#e6eaff", "#232c4d", "Background for accent chips (active @context chip, selected mini-calendar day, text selection).")
c("focus-ring", "{accent}", "{accent}", "2px solid focus outline, offset 2px, on every interactive element. 3:1 on all surfaces in both themes.")
c("danger", "#b42f25", "#ff8f82", "Destructive text and icons: Delete, Clear annotations, sync error. Also the recording dot.")
c("danger-soft", "#fbe7e4", "#3d201d", "Ground for the sync-error banner and destructive-confirm modals.")
c("highlight", "#fff1a6", "#5a4b12", "Highlighter marker behind text inside notes (the yellow sweep) — text on it stays `ink`.")

# ---- Pastel families: wash (group container), tint (chip), edge (border), ink (text), solid (dots/bars)
fam = {
 "rose":  dict(wash=("#fcedf1","#33222a"), tint=("#f8dbe4","#4a2a35"), edge=("#f0cdd8","#553240"), ink=("#9a2d50","#f5aac2"), solid=("#df5f86","#e0729a")),
 "sky":   dict(wash=("#eaf0fd","#1d2638"), tint=("#d8e3fb","#263352"), edge=("#cddbf6","#2e3d60"), ink=("#274c97","#aac4f8"), solid=("#4f84ea","#6f9bf0")),
 "sage":  dict(wash=("#e9f5e6","#1d2d20"), tint=("#d3ebcd","#26402a"), edge=("#c8e3c1","#2e4b33"), ink=("#2c6633","#a2d8a7"), solid=("#4fa65d","#6bbf78")),
 "amber": dict(wash=("#fdf2e2","#33271a"), tint=("#fbe2bd","#4a3620"), edge=("#f3d9b0","#553f25"), ink=("#86500f","#f3c580"), solid=("#e8932c","#eca24a")),
 "lilac": dict(wash=("#f1ecfb","#271f36"), tint=("#e3daf8","#352a4c"), edge=("#dcd1f4","#3e3259"), ink=("#5a3ea6","#cbb9f6"), solid=("#9072e0","#a38cea")),
 "stone": dict(wash=("#f1eee9","#242220"), tint=("#e5e0d8","#33302c"), edge=("#e0dbd2","#3d3a35"), ink=("#5c554c","#cfc7bc"), solid=("#a39a8d","#8b8378")),
}
role = {
 "rose": "Rose — priority High, the Pending/blocked column, personal/diary notes.",
 "sky": "Sky — the default project tint, priority Low, calendar events, studies/lectures.",
 "sage": "Sage — Completed status, streak 'done' days, positive deltas.",
 "amber": "Amber — In progress, priority Medium, the streak flame, due-soon dates.",
 "lilac": "Lilac — Under review, and Clio AI's own surfaces (smart notes, chat).",
 "stone": "Stone — Not started, untagged/unsorted notes, neutral chips.",
}
part = {
 "wash": "Large pastel group container (note groups, kanban columns tinted by project, folder cards). Hosts `surface-raised` cards and `{f}-ink` headings.",
 "tint": "Chip/pill ground (tags, status pills, priority flags) with `{f}-ink` text.",
 "edge": "1px border around a `{f}-wash` container so it holds its shape on `surface`.",
 "ink": "Text and icons on `{f}-wash` and `{f}-tint` (≥4.5:1). Group headings, chip labels.",
 "solid": "Non-text marks only: progress dots, chart bars, calendar event rails, folder tabs, the project colour dot.",
}
for f, parts in fam.items():
    for p, (l, d) in parts.items():
        c(f"{f}-{p}", l, d, role[f] + " " + part[p].format(f=f))

# ---- AI
c("ai-wash", "#f6effb", "#231d2c", "Ground of the Clio AI panel (chat + smart notes). A flat lilac-pink wash — never a gradient.")
c("ai-ink", "#6a3a9e", "#d2b6f2", "The AI mark, 'Thought for Ns' disclosure, streaming caret and AI-authored labels on `ai-wash`.")
# ---- Paper / canvas
c("paper", "#ffffff", "#1e1d1b", "Notebook and PDF page ground on the Note Canvas.")
c("paper-rule", "#d5e3f4", "#2b3442", "Horizontal ruled lines on notebook pages (every `lineSpacing`, default 32px).")
c("paper-margin", "#f1bcbc", "#4a2b2b", "Vertical red margin rule on ruled notebook pages.")
# ---- Chart
c("chart-bar", "#e8e3da", "#34312d", "Resting bars in stat/streak charts.")
c("chart-bar-active", "{accent}", "{accent}", "The highlighted bar (today / selected) with its value tooltip.")
c("chart-grid", "#ece8e1", "#2c2a27", "Chart gridlines and the dashed average rule.")
# ---- Pen inks (data, same in both themes except black which stays true black on paper)
pens = [("pen-black","#111111","Black ink — default pen."),("pen-cobalt","#0b3aa6","Cobalt ink."),("pen-red","#c8221f","Red ink."),
        ("pen-amber","#d98e04","Amber ink."),("pen-teal","#00897b","Teal ink."),("pen-azure","#0288d1","Azure ink."),("pen-violet","#8e44c4","Violet ink.")]
for n,v,u in pens:
    c(n, v, v if n!="pen-black" else "#f3efe8", u+" A stroke colour in the Tool Palette — stored with the stroke, shown as a swatch. In dark, black ink renders as paper so strokes stay visible.")
c("marker-yellow", "rgba(255, 214, 10, 0.42)", "rgba(255, 214, 10, 0.34)", "Highlighter tool stroke (multiply blend on paper).")

# ---------- contrast check
def hx(h):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def lum(h):
    r=[x/12.92 if x<=0.03928 else ((x+0.055)/1.055)**2.4 for x in hx(h)]
    return 0.2126*r[0]+0.7152*r[1]+0.0722*r[2]
def cr(a,b):
    la,lb=lum(a),lum(b); return (max(la,lb)+0.05)/(min(la,lb)+0.05)
T={n:(l,d) for n,l,d,u in C}
def res(v,i):
    while v.startswith('{'): v=T[v[1:-1]][i]
    return v
checks=[("ink",g,4.5) for g in ["surface-sidebar","surface","surface-raised","surface-inset","surface-hover","surface-selected"]]
checks+=[("ink-2",g,4.5) for g in ["surface-sidebar","surface","surface-raised","surface-inset"]]
checks+=[("ink-3",g,4.5) for g in ["surface","surface-raised","surface-sidebar"]]
checks+=[("ink-inverse","primary",4.5),("accent","surface",4.5),("accent","surface-raised",4.5),("accent","accent-soft",4.5),
         ("line-strong","surface",3),("line-strong","surface-raised",3),("danger","surface-raised",4.5),("danger","danger-soft",4.5),
         ("ink","highlight",4.5),("ai-ink","ai-wash",4.5),("ink","ai-wash",4.5),("ink-2","ai-wash",4.5),("chart-bar-active","surface-raised",3)]
for f in fam:
    checks+=[(f"{f}-ink",f"{f}-wash",4.5),(f"{f}-ink",f"{f}-tint",4.5),(f"{f}-solid","surface-raised",2.2)]
bad=0
for a,b,m in checks:
    for i,th in enumerate(["light","dark"]):
        v=cr(res(T[a][i],i),res(T[b][i],i))
        if v<m: bad+=1; print(f"FAIL {th} {a} on {b}: {v:.2f} < {m}")
print("checks", len(checks)*2, "fails", bad)

tokens = {
 "name": "Clio", "version": 1,
 "color": {"themes": [{"id":"light","name":"Paper"},{"id":"dark","name":"Graphite"}],
   "tokens": [{"name":n,"value":{"light":l,"dark":d},"usage":u} for n,l,d,u in C]},
 "type": {
   "fonts": [
     {"family":"Figtree","file":"fonts/Figtree-Variable.woff2","weight":"300 900","style":"normal"},
     {"family":"Figtree","file":"fonts/Figtree-Variable-Italic.woff2","weight":"300 900","style":"italic"},
     {"family":"Newsreader","file":"fonts/Newsreader-Variable.woff2","weight":"200 800","style":"normal"},
     {"family":"Newsreader","file":"fonts/Newsreader-Variable-Italic.woff2","weight":"200 800","style":"italic"},
     {"family":"JetBrains Mono","file":"fonts/JetBrainsMono-Variable.woff2","weight":"100 800","style":"normal"}],
   "families": {
     "sans": "\"Figtree\", ui-sans-serif, system-ui, -apple-system, sans-serif",
     "serif": "\"Newsreader\", ui-serif, Georgia, serif",
     "mono": "\"JetBrains Mono\", ui-monospace, \"SF Mono\", Menlo, monospace"},
   "groups": [
     {"name":"Display","family":"sans","styles":[
       {"name":"display","fontSize":"34px","lineHeight":"40px","fontWeight":700,"letterSpacing":"-0.02em","sample":"Welcome back, Thomas","usage":"One per view: the page title (Dailies, Project Hub, Kanban Board)."},
       {"name":"stat","fontSize":"32px","lineHeight":"36px","fontWeight":700,"letterSpacing":"-0.02em","sample":"12 days","usage":"The big number in StatCard, StreakCard, ChartCard. Tabular figures."},
       {"name":"title-lg","fontSize":"22px","lineHeight":"28px","fontWeight":700,"letterSpacing":"-0.01em","sample":"Active Projects","usage":"Section headings inside a view; modal titles."},
       {"name":"title","fontSize":"17px","lineHeight":"24px","fontWeight":650,"sample":"Graph VQ-Transformer notes","usage":"Card titles (project, note, task detail), panel titles."}]},
     {"name":"Interface","family":"sans","styles":[
       {"name":"body","fontSize":"14px","lineHeight":"21px","fontWeight":400,"sample":"Stay on top of your papers, notes and tasks.","usage":"Default UI text: descriptions, chat messages, form values."},
       {"name":"body-strong","fontSize":"14px","lineHeight":"21px","fontWeight":600,"sample":"Summarise this paper","usage":"Nav items when selected, task titles, button labels."},
       {"name":"body-sm","fontSize":"13px","lineHeight":"18px","fontWeight":400,"sample":"Due Mar 21 · 3 comments","usage":"Meta lines, card footers, sidebar items, menu items."},
       {"name":"label","fontSize":"12px","lineHeight":"16px","fontWeight":600,"sample":"In progress","usage":"Chips, status pills, form field labels, segmented-control items."},
       {"name":"overline","fontSize":"11px","lineHeight":"14px","fontWeight":650,"letterSpacing":"0.08em","sample":"WORKSPACES","usage":"Uppercase section overlines in the sidebar and inspector. Always `ink-3`."}]},
     {"name":"Reading","family":"serif","styles":[
       {"name":"note-title","fontSize":"24px","lineHeight":"30px","fontWeight":600,"sample":"Introduction to diffusion models","usage":"Title of an open note / notepad; NoteCard headline."},
       {"name":"note-body","fontSize":"16px","lineHeight":"26px","fontWeight":400,"sample":"The forward process gradually adds Gaussian noise to a molecule graph.","usage":"Long-form note text, smart-note output, AI answers longer than three paragraphs."}]},
     {"name":"Meta","family":"mono","styles":[
       {"name":"mono","fontSize":"12px","lineHeight":"16px","fontWeight":500,"sample":"CLIO-21 · 2512.02667","usage":"Task keys, arXiv ids, file sizes, times in the agenda, keyboard hints."}]}]},
 "spacing": {"tokens":[
   {"name":"space-0-5","value":"2px","usage":"Gap between stacked chips, icon-to-count."},
   {"name":"space-1","value":"4px","usage":"Icon-to-label inside chips; segmented track padding."},
   {"name":"space-2","value":"8px","usage":"Gap between buttons; row padding (y) in nav and lists."},
   {"name":"space-3","value":"12px","usage":"Nav item padding (x); gap between cards in a column."},
   {"name":"space-4","value":"16px","usage":"Card padding; gap between cards in grids."},
   {"name":"space-5","value":"20px","usage":"Group container padding; panel padding."},
   {"name":"space-6","value":"24px","usage":"Gap between sections of a card; modal padding."},
   {"name":"space-8","value":"32px","usage":"View padding on tablets; gap between view sections."},
   {"name":"space-10","value":"40px","usage":"View padding on desktop."},
   {"name":"space-12","value":"48px","usage":"Top padding above a view's display title."}]},
 "radius": {"tokens":[
   {"name":"radius-xs","value":"6px","usage":"Chips, tags, status pills, kbd, checkboxes."},
   {"name":"radius-sm","value":"8px","usage":"Buttons, inputs, nav items, menu items, segmented items."},
   {"name":"radius-md","value":"12px","usage":"Cards: note, task, project, stat, paper."},
   {"name":"radius-lg","value":"18px","usage":"Pastel group containers, kanban columns, panels, modals, the tool dock."},
   {"name":"radius-xl","value":"24px","usage":"The app window and the AI composer."},
   {"name":"radius-pill","value":"999px","usage":"Avatars, streak day bubbles, the user chat bubble, send button."}]},
 "shadow": {"tokens":[
   {"name":"shadow-card","value":{"light":"0 1px 2px rgba(31, 28, 24, 0.05), 0 1px 1px rgba(31, 28, 24, 0.03)","dark":"0 1px 2px rgba(0, 0, 0, 0.4)"},"usage":"Resting cards on a wash or surface."},
   {"name":"shadow-lift","value":{"light":"0 12px 28px rgba(31, 28, 24, 0.14), 0 2px 6px rgba(31, 28, 24, 0.08)","dark":"0 12px 28px rgba(0, 0, 0, 0.55)"},"usage":"A card being dragged (kanban, sticky notes) — paired with a 2° tilt."},
   {"name":"shadow-float","value":{"light":"0 8px 24px rgba(31, 28, 24, 0.10), 0 1px 3px rgba(31, 28, 24, 0.08)","dark":"0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04)"},"usage":"Floating chrome: tool dock, tool popover, menus, tooltips, composer."},
   {"name":"shadow-window","value":{"light":"0 30px 80px rgba(31, 28, 24, 0.18), 0 0 0 1px rgba(31, 28, 24, 0.06)","dark":"0 30px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)"},"usage":"Modals and the app window over the wallpaper."}]},
 "size": {"tokens":[
   {"name":"sidebar-width","value":"256px","usage":"Expanded sidebar. Collapses to a drawer below 1000px."},
   {"name":"panel-width","value":"380px","usage":"Default right AI panel width (resizable 320–560px)."},
   {"name":"topbar-height","value":"56px","usage":"Document header / top bar."},
   {"name":"control-height","value":"36px","usage":"Buttons, inputs, search field."},
   {"name":"control-height-sm","value":"28px","usage":"Compact buttons, segmented items, icon buttons in card headers."},
   {"name":"hit-target","value":"44px","usage":"Minimum touch target on tablet (pen tools, dock buttons)."}]},
}
json.dump(tokens, open('/home/claude/clio-ds/project/tokens.json','w'), indent=1, ensure_ascii=False)
print(len(C), "colors")
