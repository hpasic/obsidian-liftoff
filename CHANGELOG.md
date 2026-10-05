# Changelog

All notable changes to LiftOff. Newest first; each release has a `## <version> - <date>` section, which is also what the plugin shows in "What's new" after an update.

## 0.5.2 - 2026-10-05

- Finishing a workout while an interval timer is still running or paused now keeps the timer's settings and adds "Timer stopped early." to its note, instead of saving it as not started.
- Two workouts on the same day are ordered by start time, so the later session's numbers and note fill in next time.
- Each weight row shows its own unit, so a weight carried over in kg stays kg even when your default unit is lbs.
- LiftOff now has a Donate button in Community Plugins. If it helps your training, [buy me a coffee on Ko-fi](https://ko-fi.com/hpasic).

## 0.5.1 - 2026-09-23

- New "What's new" window after an update shows what changed since the version you last used. Turn it off in settings with **Show what's new after updates**.
- Exercises picked from the built-in catalog while editing a template are now saved to your library as catalog exercises, the same as picks made during a workout.
- The exercise picker works from the keyboard: Tab to a body-part chip or a result and press Enter or Space.
- The bundled exercise catalog is now sorted the same way on every machine.

## 0.5.0 - 2026-09-23

- Holds start with a short "Get set" count-down, and the same buffer is subtracted when you stop, so the saved time is the hold itself. Set it in **Hold buffer** (default 5 seconds, 0 turns it off).
- Add an optional weight to any hold for loaded carries and weighted planks. A weight carried over from last time keeps its unit.
- The screen stays on while an interval timer, hold, or rest timer is running (**Keep screen awake**, on by default).
- Last session's note for an exercise shows up under its name. An exercise with a note is saved even when you skipped all its sets, without hiding your earlier numbers.

## 0.4.0 - 2026-09-23

- Adding an exercise now searches your own library and a built-in catalog of 1,318 exercises at once. Search by name, muscle, or equipment; shorthand like `db curl` works.
- Browse the catalog by body part with a row of chips.
- **+ Create** is always there, so anything missing is one tap away, as a weight exercise, an interval timer, or a hold.
