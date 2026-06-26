# Design

## Theme

Dark terminal — ops console aesthetic. Deep navy-black background with a subtle indigo mesh gradient. All surfaces are translucent dark panels. Status indicators pop against the neutral field.

## Colors

```
--bg:         #060A18  (deep navy-black, body background)
--bg-mesh:    radial-gradient indigo + violet (subtle, fixed)
--surface:    #0D1124  (card / panel background)
--surface-2:  #111827
--surface-3:  #1A2035
--border:     rgba(255,255,255,0.07)
--border-mid: rgba(255,255,255,0.11)
--text:       #E8EBF4  (primary text)
--text-2:     #8B95B0  (secondary text)
--text-3:     #4A5568  (muted / placeholder)
--indigo:     #6366F1  (primary accent — actions, active states, links)
--violet:     #7C3AED  (gradient partner for indigo)
--emerald:    #10B981  (success / approved)
--orange:     #F97316  (warning / pending review)
--rose:       #F43F5E  (escalated / error)
```

## Typography

- Body: Inter (system sans fallback)
- Mono / IDs: Geist Mono
- Body text: 0.75rem–0.875rem for dense product UI
- No display font — Inter across all scales

## Components

### Cards

- `.card-glow` — surface background + translucent border + deep shadow + hover glow. Used for all dashboard panels and content sections.
- `.kpi-card` — variant of card-glow with colored accent top line on hover and per-variant glow (indigo / emerald / orange / rose).
- `.claim-card` — interactive card with hover lift + indigo border glow.

### Buttons

- `.btn-primary` — indigo→violet gradient, white text, shadow glow on hover.
- `.btn-ghost` — translucent surface, muted text, subtle border. Used for secondary actions.

### Forms

- `.input-dark` — translucent surface, dim border, indigo focus ring + glow.
- `.select-dark` — same treatment as input-dark.

### Navigation

- `.sidebar-bg` — near-black blurred glass, border-right. Active state: indigo tinted bg + left indicator bar.
- `.topbar-bg` — blurred glass header with indigo live indicator and gradient accent line on new-claim pages.

### Badges

- StatusBadge / PriorityBadge: colored translucent backgrounds with matching border + dot. All semantic colors use opacity variants (no solid light backgrounds).

## Animations

- `fade-up` — 0.35s cubic-bezier(0.16,1,0.3,1), staggered 0–0.20s delays
- `live-dot` — indigo pulsing ring for live indicators
- `live-dot-emerald` — emerald variant for success states
- `status-pulse` — opacity pulse for active processing
- `shimmer` — skeleton loading gradient
- All animations: `prefers-reduced-motion` respected (disabled or crossfade)

## Layout

- Sidebar: 208px fixed left, full height
- Content: `md:pl-52` offset, max-w-7xl centered, px-6 py-8
- Dashboard: 4-col KPI grid → 5-col activity+feed → 3-col status+stats
- Claims table: hidden on mobile, card list on mobile
