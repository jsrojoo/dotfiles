# Responsive Frontend

## Core Principles
- Think in boxes and parent-child relationships to plan layout structure.
- Break layouts into rows and columns and let boxes move between them as the viewport changes.
- Sketch a rough layout and breakpoint behavior before writing HTML or CSS.
- Default to flexbox for most layout work and switch to grid when you need rigid, column-precise control.
- Use descriptive, unique class names to make debugging and maintenance easier.

## Flexbox Playbook
- Apply `display: flex` to the parent and treat direct children as the flex items.
- Use `flex-wrap: wrap` to allow items to move into new rows on smaller screens.
- Use `gap` to create consistent spacing between items.
- Use `justify-content: space-between` to distribute leftover space between header items.
- Use `flex-grow` to fill empty space and set larger values for proportional emphasis.
- Use `flex-shrink: 0` to prevent items from collapsing when space gets tight.
- Use `flex-basis` to define a starting size and avoid uneven growth from `auto`.
- Use the `flex: grow shrink basis` shorthand for the common "start size then grow/shrink" pattern.

## Grid Playbook
- Use grid when you want strict control over rows and columns in the parent.
- Define columns with `grid-template-columns` and `fr` units for proportional sizing.
- Use `repeat(auto-fit, minmax(min, 1fr))` for responsive column counts.
- Use `min()` inside `minmax()` to prevent overflow on small screens.
- Use grid for cards and tables when consistent column widths matter.

## Media Queries
- Use media queries for behavior that is too complex for flex or grid alone.
- Base queries on viewport width and keep changes minimal and targeted.
- Move media queries to the end of the stylesheet to avoid cascade surprises.

## Positioning Rules
- Use `position: relative` on a container when you need absolutely positioned children.
- Use `position: absolute` to take an element out of normal flow and place it precisely.
- Use `position: fixed` for elements that should stay on screen during scroll.
- Use `position: sticky` for headers or sidebars that should stick after a scroll threshold.
- Add `align-self: flex-start` when a sticky item sits inside a flex parent.

## Sidebar/Content Pattern
- Structure the main layout as a parent with two children: sidebar and main content.
- Give the main content `flex-grow: 1` so it fills remaining space.
- When toggling a sidebar, prefer `display: none` on small screens to avoid layout shifts.

## Process Checklist
- Draw a simple parent-child tree before writing HTML.
- Identify which containers are flex vs grid based on rigidity needed.
- Validate behavior at phone, tablet, and desktop sizes.
- Apply media queries only where flex or grid cannot express the behavior cleanly.
- Consider theme toggles or `prefers-color-scheme` early because it is cheap and high-impact.

## Best Practices
- Prefer relative units (`%`, `vw`, `vh`, `em`, `rem`) over fixed pixels so layouts scale naturally.
- Avoid fixed heights; use `min-height` or `height: auto` to prevent overflow on smaller screens.
- Optimize performance with lazy-loaded, compressed images (prefer WebP where supported).
- Keep touch targets large and comfortable; aim for at least `48x48` logical pixels.

```css
.container {
  width: 80vw;
  font-size: 1.2em;
}

.section {
  min-height: 50vh;
}
```

```html
<img src="image.webp" loading="lazy" alt="Optimized image">
```

```html
<button class="px-4 py-2 text-lg">Click Me</button>
```
