# ADR 0003 · Motion policy

- **Status:** accepted
- **Date:** 2026-11-23

## Context

Motion is what makes a scenario easy to follow: a packet moving from `api` to `payments` says more than an arrow. It is also easy to overdo. Looping animations distract, autoplay surprises people, and motion can make some readers feel unwell. Design-review pages are read slowly and often reopened; they should feel like a document, not an ad.

## Decision

1. **Reader in control.** Play, pause, step, scrub, and speed are always available (except with `controls: none`, where the keyboard still works).
2. **Autoplay at most once.** Only with `playback: auto`, only once per page load, and only if the reader hasn't interacted yet. Changing view or scenario doesn't autoplay.
3. **Never loop.** A scenario stops on its verdict. Nothing animates while idle: no pulsing, no ambient motion.
4. **Respect `prefers-reduced-motion`.** Steps change instantly, packets appear at the middle of their edge with no travel, and the camera jumps instead of tweening. Autoplay is off.
5. **Pause when hidden.** Playback pauses when the tab is hidden and doesn't resume by itself.
6. **Calm timing.** Defaults: about 2.8 s per step, about 0.9 s per packet, about 0.65 s per camera move, ease-in-out. Speed options 0.5×, 1×, 2×.
7. **Motion carries meaning.** Each animation shows something that happens in the system (a call, a response, a retry). Decorative motion isn't allowed in the runtime.

## Consequences

- The page is usable with motion fully off. The final frame and the captions tell the whole story, and `playback: off` makes this the default.
- Some "wow" is given up on purpose.
- The runtime has to support instant rendering of any step, which also makes scrubbing and deep links simple.
