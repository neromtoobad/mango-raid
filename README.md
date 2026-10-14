# MANGO RAID

**Knock am. No wake Baba.**

Play: **https://mangoraid.nerom.site**

MANGO RAID is a first-person catapult game set in a Lagos lane. You're outside Baba's compound wall with a catapult and a pocket of stones. Knock the tins off his wall and the ripe mangoes off his tree, and keep it quiet: every clang fills Baba's NOISE meter. Fill it and he comes out with his cane. Break his window and it's over.

Built from scratch for **Twigpine Project Treetop, Round 01 (Games)**, 9 to 16 October 2026.

## How to play

- **Pull and aim:** press anywhere and drag back. The crosshair moves the opposite way. The sight is zeroed at the wall, so stones drop a little more on the way to the tree, and far mangoes need a slightly higher aim.
- **Let go** to fire. If you hold too long, your arm starts to shake.
- **Ripe mangoes** (yellow-red) score. Green ones are wasted.
- **Tins are loud and mangoes are soft.** The noise slowly fades while Baba dozes off again. If the meter fills, you get 4 seconds before he reaches you.
- **Stars:** clear the level, keep Baba asleep, and finish with stones to spare.

## Worlds and modes

- **Baba's Compound** (12 raids):
  1. Three Tins
  2. Small Pyramid
  3. First Mangoes
  4. Mind The Window
  5. The Veranda
  6. Harmattan (wind)
  7. Swinging Tin
  8. High Mangoes
  9. Light Sleeper
  10. Tight Gaps
  11. Evening Raid
  12. Baba Dey Look
- **NEPA Night** (6 raids): the same compound after dark, with fireflies, crickets and a lamp in the window.
  - Every few seconds NEPA takes light and the street goes dark.
  - Baba's generator then kicks in and covers your noise.
  - You can shoot loud while the power is out, but you can barely see. When the light comes back, the whole street shouts "UP NEPA!".
- **School Compound** (6 raids): the Headmaster's orange tree, glass louvre windows, and a Headmaster with a cane.
- **Mango Rush**: a 60-second score attack.
  - Tins keep coming back in new formations, and mangoes regrow.
  - Golden mangoes are worth +500 and add 5 seconds. Gold power tins give a TRIPLE SHOT or a BIG STONE.
  - Hits build a streak multiplier. Wake Baba and the run is over.
- **The agama lizard** sits on the wall doing push-ups. Miss everything and it laughs at you. Hit near it and it runs off.

## Tech

- **3D and physics:** three.js (0.160) for the scene and cannon-es (0.20) for rigid-body physics, both vendored locally. Plain ES modules, no build step, no backend.
- **Art:** a 2.5D diorama.
  - Generated art (Higgsfield): the house front, the mango tree and the neighbourhood backdrop are textured planes, and the first-person hands and Baba's expressions are generated too.
  - Built in code: the tins, mangoes, stones, wall and broken-bottle top are 3D meshes. The tin labels are original, unbranded designs drawn on a canvas.
- **Sound:** synthesized in WebAudio, with no audio files:
  - Tin clangs are built from inharmonic partials.
  - Other effects: rubber creak and twang, glass smash, leaves, Baba's snore and his shout.
  - The music is a sneaky pizzicato and shekere loop that speeds up as the noise rises.
- **Saves:** stars and best scores are kept in `localStorage`.

Run it locally by serving the folder with any static server, for example `npx serve .`.
