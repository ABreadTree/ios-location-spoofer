# Memory

## 2026-07-04 - Location service timed switch

- Added timed enable/disable for location spoofing through `loc.json` schedules.
- Schedule semantics: if at least one schedule is enabled, spoofing is active only when the current `Asia/Singapore` time matches a rule; otherwise the existing `enabled` switch stays in charge.
- Schedule format: `{ id, name, enabled, start, end, days }`, with `start`/`end` as `HH:mm` and `days` using ISO weekdays `1=Monday` through `7=Sunday`.
- Cross-midnight windows are supported and belong to the start day, e.g. Monday `22:00-02:00` covers Monday night and Tuesday early morning.
- Kept implementation intentionally small: no background cron, no new dependencies, no calendar library, and one O(n) schedule scan per intercepted request.
- Follow-up decision: schedule rows do not have user-editable names. Each row can choose a favorite location; saving copies that favorite's coordinates into the schedule rule so the runtime only reads `loc.json`.
- If multiple schedule rows match, the first matching row in list order wins.
