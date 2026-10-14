# MANGO RAID - design brief

**Pitch:** A first-person catapult game in a Lagos lane. Knock tins off Baba's wall and mangoes off his tree, and keep it quiet. Every clang wakes Baba up. Break his window and you're finished.

Built from scratch for Twigpine Project Treetop, Round 01 (Games), 9-16 Oct 2026.

## Core loop (one shot)
1. **Aim:** press anywhere and drag back. The rubber stretches and a crosshair moves the opposite way to your drag.
2. **Steady:** after about 1.2 s the arm starts to sway, so don't hold too long.
3. **Fire:** let go. The stone flies at a fixed speed along the crosshair ray, with gravity and harmattan wind.
4. **Watch:** physics plays out:
   - Tins topple and clang.
   - Hit mangoes snap off and drop.
   - Glass shatters.
5. **Noise:**
   - Every impact adds to Baba's NOISE meter (tins are loud, mangoes are soft), and the meter slowly drains.
   - Full meter: "BABA DEY COME!" The door opens, Baba walks out with his cane, and you get 4 s to finish.
   - When the 4 s run out, the level ends with whatever you've got.

## Level goals and scoring
- Each level sets goals: knock all tins off the wall, and/or drop N ripe mangoes.
- You get a limited number of stones.
- Stars:
  - 1 = goals met.
  - 2 = goals met with a stone to spare, or Baba still asleep.
  - 3 = both.
- Score:
  - Tin = 100, ripe mango = 150, green mango = 25.
  - Each unused stone = 50.
  - Combos for several things knocked by one stone: x2, x3...
- Breaking a window means instant failure: "YOU DON BREAK BABA WINDOW!"

## Levels (data-driven)
1. Three tins: the tutorial.
2. Small pyramid.
3. First mangoes.
4. Tins and mangoes with the window in play.
5. Tins at two depths (wall and veranda).
6. Harmattan wind.
7. A tin swinging on a rope from a branch.
8. High mangoes in the wind.
9. Light sleeper: a big tin tower and fast noise.
10. Two windows and tight gaps.
11. Evening light.
12. Baba at the window: his eyes open and close, and shooting while he looks counts as caught.

## Look (locked)
- Stylized warm low-poly 3D in three.js, at late-afternoon golden light.
- **Wall:** a cream plastered compound wall with broken bottle glass along the top.
- **Tree and house:** a big mango tree, and Baba's bungalow with a rusty zinc roof, a wooden window frame and a door.
- **Tins:** original unbranded labels drawn in canvas.
- **Backdrop:** a painted Lagos rooftop panorama (generated).
- **Baba:** 3D-style portraits (generated) for the noise meter and a walking billboard.
- **Catapult:** a wooden Y fork in the foreground with red inner-tube rubber and a leather pouch.

## Sound (WebAudio synth)
- **Catapult:** rubber creak on stretch and a twang on release.
- **Impacts:** metallic tin clangs (inharmonic partials), a mango thud, a leaf rustle, glass smash.
- **Ambience:** birds and distant traffic.
- **Music:** sneaky pizzicato and shekere that tighten as the meter fills, then an alarm drum when Baba comes.

## Tech
- Plain ES modules with three.js 0.160 and cannon-es 0.20, vendored locally. No build step and no backend.
- Hosted on Vercel at mangoraid.nerom.site.
