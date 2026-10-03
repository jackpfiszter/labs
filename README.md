# Labs

Interactive experiments shown in the Labs section of the portfolio. Live at https://jackpfiszter.github.io/labs/ — each piece opens at `#<id>` (e.g. `#warp`, `#spheres/atomic`); static pages live at `/labs/<id>/`.

## Adding a Gizmo export

1. Save it as `src/pieces/<Name>.tsx` (Gizmo exports contain TypeScript).
2. Add a line to `src/pieces.js`.
3. Move any `content.gizmo.party` images into `public/assets/` and point the code at `` `${import.meta.env.BASE_URL}assets/...` ``.
4. Push — GitHub Actions deploys to Pages.

`@gizmo/runtime` is replaced by `src/gizmoRuntime.js`: tweaks use their default values, haptics use the Vibration API and motion uses `deviceorientation`. Tailwind is set up so the exports' classes work as they did in Gizmo.

```bash
npm install
npm run dev
```
