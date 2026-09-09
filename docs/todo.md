### Phase 1: Infrastructure & Design System (Priority: High ⚡)

_Establish the visual and technical foundation for all subsequent components._

- [x] **1-1. Define Design Tokens**
  - Define the color palette in `package.json` or a dedicated `theme.ts` file (Primary: `#0066B3`, Success: `#00A86B`, Warning: `#F5A623`, Dark BG: `#1E1E1E`, Light BG: `#FFFFFF`).
  - Import and apply **Inter** (for UI text) and **JetBrains Mono** (for technical text/code) fonts in the WebView.

- [ ] **1-2. Implement Bento Grid Layout System**
  - Create a flexible CSS Grid/Flexbox system for the dashboard that supports variable card sizes (1x, 2x, full-width) to organize information neatly.

- [ ] **1-3. Set Up Icon Library**
  - Add a professional SVG icon library (**Heroicons** or **Lucide**) to the project. Replace all emojis with these icons across buttons, status indicators, and the sidebar.

---

### Phase 2: Sidebar Tree View Redesign (Priority: High ⚡)

_Enhance daily interaction and information density for branch management._

- [ ] **2-1. Visual Grouping of Branches**
  - Add color-coded badges or small icons next to each branch name to visually distinguish types (e.g., `feature/*`, `release/*`, `hotfix/*`, `main`).

- [ ] **2-2. Display Supplementary Info in Tree Nodes**
  - Modify the TreeView provider to show the "last commit message" as a subtitle or muted text below each branch name.
  - Add a divergence indicator (e.g., `↑2 ↓1`) to show how many commits the branch is ahead/behind the main branch.

- [ ] **2-3. Enrich Context Menu (Right-Click)**
  - Add new, high-frequency options to the right-click menu: "Compare with Main", "Show Log", and "Finish & Merge".

---

### Phase 3: Dashboard WebView Redesign (Priority: Medium 🚀)

_Create a modern, visually appealing command center._

- [ ] **3-1. Redesign Header & Quick Actions**
  - Design an attractive header with the extension's text logo and large, prominent action buttons for `Start`, `Pull`, `Push`, and `Doctor` at the top, utilizing Lucide/Heroicons.

- [ ] **3-2. Implement Informational Cards (Bento Grid)**
  - **Workflow Status Card**: Display the current repository state (Clean, WIP, Conflict) with accent colors and descriptive text.
  - **Worktree Status Card**: List all active worktrees in a compact, scannable format.
  - **Branch Rules Card**: Show configured rules per branch type clearly.

- [ ] **3-3. Enhance the Git Graph Visualization**
  - Upgrade the graph component with the new color palette and improved line thickness. Add a small legend to explain color meanings.
  - Implement a smooth loading/updating animation when the graph refreshes.

- [ ] **3-4. Implement Auto-Refresh**
  - Ensure the dashboard data (graph, status, cards) updates automatically upon any Git event (commit, branch switch, push/pull) without requiring a manual refresh button click.

---

### Phase 4: Status Bar Redesign (Priority: Medium 🚀)

_Provide faster access to critical information and common actions._

- [ ] **4-1. Replace Text with Visual Indicator**
  - Replace the plain text status with a colored dot (Green 🟢 = Clean, Yellow 🟡 = Uncommitted changes, Red 🔴 = Conflict) accompanied by a short descriptive text (e.g., "Clean", "Changes", "Conflicts").

- [ ] **4-2. Add Quick-Pick Menu on Click**
  - Implement a small Quick Pick menu that appears when clicking the status bar item, offering options like `Gitwe: Pull`, `Gitwe: Push`, and `Open Dashboard` for rapid execution.

---

### Phase 5: Accessibility & Animations (Priority: Low but Essential ♿)

_Finalize the user experience to be inclusive and polished._

- [ ] **5-1. Improve Keyboard Focus Visibility**
  - Add explicit `:focus-visible` styles to all interactive elements (buttons, cards, tree nodes) so keyboard users can clearly navigate the interface.

- [ ] **5-2. Enforce Color Contrast Standards**
  - Audit all text/background combinations using contrast-checking tools. Ensure a minimum ratio of **4.5:1**, especially for the Light theme.

- [ ] **5-3. Implement `prefers-reduced-motion`**
  - Wrap all CSS animations and transitions inside `@media (prefers-reduced-motion: reduce)` to respect the user's OS motion settings.

- [ ] **5-4. Add ARIA Labels**
  - Add appropriate `aria-label` attributes to all icon-only buttons and non-textual elements in both the WebView and the TreeView for screen reader compatibility.

---

### Phase 6: Testing, Documentation & Release (Priority: Final ✅)

_Ensure quality assurance and prepare the final delivery._

- [ ] **6-1. Test on Light and Dark Themes**
  - Thoroughly review the extension's UI appearance in both VS Code default themes (Light+ and Dark+) and fix any visual inconsistencies.

- [ ] **6-2. Performance Testing**
  - Verify that opening the dashboard and rendering the Git graph does not cause noticeable lag or high CPU usage, especially for large repositories with complex histories.

- [ ] **6-3. Update Documentation**
  - Update the project's `README.md` and Wiki with new screenshots of the redesigned interface. Add clear explanations for all new features introduced in this redesign.

- [ ] **6-4. Create Pull Request for the `new` Branch**
  - Merge all changes into the `new` branch locally, push, and open a Pull Request to the main repository for final code review and merge.
