# doors/

The room-entry transition on Screen 1.

Put here **one** of:
- A door-opening video (MP4/MOV), straight-on fixed camera, 1.0–1.5s, starting on
  a closed light-oak door and ending fully open. Short matters more than pretty —
  a doctor triggers this 15 times a morning.
- Or a numbered image sequence (`001.png`, `002.png`, …), same requirements.

One generic door is enough; it gets reused for every room while the selected room
number stays in app state and is composited onto the door. If you upload per-room
assets instead, name them so the room number is unambiguous (`room-07.mp4`) and
they'll be mapped by number.

Ideally the last frame is bright/open enough to cross-fade into the room screen
without a visible seam.
