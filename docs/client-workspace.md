# Client workspace visual system

The authenticated workspace at `/app` is a hospitality command center. Client branding comes first. Onwarda stays secondary.

## Surfaces

- Page: cream `#F8F2ED`, overridable by the organization background token
- Elevated cards: white `#FFFCFA`
- Navigation: white with an olive-tinted active pill and a coral inset mark
- Coral is an accent for attention and the active indicator, not a field of color

Organization colors map to `--client-primary`, `--client-secondary`, and `--client-accent`. Body text stays charcoal so a light brand color cannot erase labels.

## Hierarchy

- Page titles use the display scale
- Operational work sits above reference lists
- Billing, settings, and account stay in the lower navigation
- Empty states explain the next real action and only show a button the current role can already use

## Motion

Hover lift and navigation color changes run about 180ms. They turn off when `prefers-reduced-motion` is set.

## Responsive

Desktop uses a fixed sidebar inside a 1600px frame. Mobile uses a header menu and a bottom bar for Overview, Calendar, Properties, and Cleaning, with More for the rest. Routes and permissions are unchanged.

## Operations calendar

`/app` leads with the operations calendar and `/app/calendar` is the expanded view. Both render the same component; only the base path for navigation links differs.

### Projection, not a data model

`getWorkspaceCalendar()` in `src/lib/calendar/load.ts` reads `properties`, `reservations`, and `cleaning_tasks` and hands them to the pure `buildCalendarProjection()` in `src/lib/calendar/model.ts`. There are no calendar tables, no calendar migration, and no writes. Deleting the two files would leave the data model untouched.

Reading happens through `createSupabaseServerClient()` after `requireWorkspaceView()`, so RLS stays authoritative and the organization comes from the session. `view` and `date` are UI state: `view` is narrowed to `month` or `week`, and `date` is accepted only if it round-trips as a real `YYYY-MM-DD` date, otherwise it falls back to today. Neither one reaches a query as a tenant identifier.

Every query is bounded to the visible window. Stays overlap the window when `check_in <= end` and `check_out > start`. Cleaning tasks are fetched when they were created inside the window or are still open, capped at 400 rows.

### Reading the timeline

Properties are rows, dates are columns, and the property column stays pinned while the dates scroll. Every non-archived property gets a row, including quiet ones.

A stay occupies its nights, so the departure day belongs to the next arrival. Same-day turnover therefore reads as two adjacent blocks rather than an overlap, and a real double booking is the only thing that stacks onto a second lane — those blocks get a dashed outline and a count above the grid.

Cleaning blocks are anchored on the checkout day and stay open until the task completes, which is how a property on hold stays visible. Status is carried by a text marker and a screen reader label as well as colour, the scroll region is keyboard reachable, and a legend sits under the grid. Below `md` the grid is replaced by a day-grouped agenda where each entry leads with its property name.

### Staying current

The workspace renders dynamically, so navigating or submitting anything re-runs the projection under the current user. `CalendarRefresh` adds a `router.refresh()` when the tab regains focus, throttled to once every 15 seconds, which covers a cleaner finishing on their own phone while the operator has the tab open.

There is no realtime subscription. A Supabase channel would need a client-side connection and per-row tenant filtering outside RLS, which is more exposure than this is worth; server revalidation gives the same result through the path that is already authorized.
