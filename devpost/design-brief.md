---
status: approved
---

# Design brief: Sunday Sort

## The one spatial moment
I'm standing at the kitchen counter with my grandmother's weekly pillbox in front of me and five bottles beside it. I pick up a bottle, pinch it, and exactly the cells it goes into light up on the box itself — with how many pills — so my eyes never leave the box. I drop the pills in, pinch one big Done button, and reach for the next bottle.

## Why it belongs on glasses
- Uses: **draws in the world** (the counts sit on the actual cells they belong to), **leaves your body free** (both hands stay on bottles and pills, eyes stay down on the box), and on real glasses **shares your view** (the camera reads the bottle label I'm already holding).
- Why it's better than the phone or laptop version: the hard part isn't knowing the schedule, it's keeping your place. You read the list, look at the box, look back at the list, and it's easy to drop a pill in the wrong cell or skip a bottle. A phone keeps that context switch and needs a hand you don't have. In one Northwestern study, 60% of paid home caregivers made pillbox errors. Putting the answer on the cell removes the look-away entirely.

## Product or overlay
- Type: **overlay** — it responds to real bottles and a real pillbox.
- What the real version would sense: which bottle is in my hand (reading the label with the camera), and where the real box sits on the counter with its 14 cells.
- Stand-in for the preview:
  - **Bottle identity:** I aim at a bottle and pinch the bottle itself, not a separate button. The pinch stands in for the glasses reading the label. A small card pops up above it — "Found: Metformin 500 mg" — and its cells light up. No "Found it" button anywhere; the bottle is the button.
  - **The box:** a virtual pillbox at real size on a virtual kitchen counter, already placed about 60 cm in front of me and a little below eye level when the Lens starts, so nothing has to be detected. On real glasses the camera would find the box on the counter, or I'd pinch it once to anchor it. The demo doesn't need that.

## Where things live
- Where the user is looking during the main task: down and slightly forward at the box, 60 cm away, a little below eye level. At that distance the glasses show roughly 23 cm tall by 38 cm wide, so the whole 22 cm box stays in frame without moving my head.
- **Pillbox:** on the virtual counter, 60 cm in front, below eye level. About 22 cm wide x 8 cm deep. 14 cells of about 3 cm: 7 days MON to SUN left to right, morning row at the back, evening row at the front. Day labels along the back edge.
- **Bottle group:** four bottles in a small 2x2 group just right of the box, each about 4 cm wide x 8 cm tall — a big enough target to pinch.
- **Vitamin D bottle:** on a shelf to my left, deliberately outside the view while I'm working on the box.
- **Bottle card:** floats just above the bottle I pinched. Metformin's reads "Found: Metformin 500 mg". Furosemide's adds "½ tablet — split before you start".
- **A lit cell** shows three things and nothing else: a bright cyan ring around the cell's rim, a big count floating about 2 cm above it ("1", "2" or "½", about 2 cm tall so it reads from 60 cm), and a small icon in that pill's own shape and colour (see the table below). Every pill colour is bright, so it survives the additive display. Cells that get nothing from this bottle stay dark. The day labels brighten for the lit days too, so I can double-check the day without counting cells.
- **Progress dots:** one dot per bottle along the back edge of the box; a dot fills when that bottle is done.
- **Done button:** about 8 cm, at the front-right corner of the box, tilted toward me.
- **Undo button:** smaller, next to Done.
- **Out-of-view arrow:** at the left edge of my view, just beside the box, reading "1 left: Vitamin D".
- **Doctor's change card** (stretch): a single card beside the box.

### The five bottles
| Bottle | Goes into | Count per cell | Pill icon |
|---|---|---|---|
| Metformin 500 mg | all 14 cells | 1 tablet | white oval |
| Amlodipine 5 mg | 7 morning cells | 1 tablet | yellow round |
| Furosemide 20 mg | MON, WED, FRI mornings only | ½ tablet | light-blue half tablet |
| Atorvastatin 20 mg | 7 evening cells | 1 tablet | pink oval |
| Vitamin D (on the left shelf) | SUN morning only | 1 capsule | amber capsule |

Each pill has its own bright colour so check mode reads at a glance. The first four stand in the 2x2 group right of the box; vitamin D is on the shelf to the left.

The pattern itself tells me which days differ before I read anything. For the half tablet the count says "½", never "0.5", and the icon is drawn as half a pill.

## Hands and input
- **Select a bottle:** aim at it — it highlights — and pinch it. That stands in for reading the label.
- **Finish a bottle:** one pinch on the big 8 cm Done button. I can hit it with one pinch even with powder on my fingers, and it's always in the same spot so my hand already knows where it is.
- **Clear a wrong selection:** pinch Undo, next to Done. It clears the selection without marking anything done.
- **Check mode:** Done becomes "All checked" in the same spot; one pinch finishes the week.
- **Dose change (stretch):** pinch the "Doctor's change" card.
- The cells themselves are only for looking, never for pressing — at 3 cm they're too small, and I'd have to press 14 of them.
- Targets are big and highlight when aimed at.
- Voice: none. Every action is a pinch on a big target.

## When things show
- **Nothing floats by default.** A bottle's card and its lit cells appear only while that bottle is selected.
- **Pinching Done** fades the glow, plays a soft chime, fills that bottle's dot, puts a small tick on the bottle, and hides its card.
- **The nudge for the out-of-view bottle** appears only once the other four are ticked, and only while the vitamin D is out of view: a single soft chime from the shelf's direction (spatial sound, so it comes from my left) and the small arrow at the left edge of my view. No arrow or sound before that, so it never nags while I'm still working. When I turn and the shelf comes into view, the arrow disappears and the bottle gets the same gentle highlight as the others. Pinching it lights its single cell, Sunday morning, on the box. When I turn back, the box is lit and waiting.
- **If I turn away from the box with a bottle still selected,** the same small arrow points me back toward the box.
- **Check mode** starts once all five bottles are ticked. Every cell now shows everything that should be in it, not just one bottle's: small pill icons in each bottle's shape and colour, plus the total. Monday morning, for example, shows a metformin, an amlodipine and half a furosemide — "2½". I compare the real cells with what's drawn on them before I close the lids. If something looks wrong I pinch that bottle again and only its cells light, so I can fix that one bottle.
- **Finishing:** pinching "All checked" plays a chime and shows "Week ready" on the box for 3 seconds, then everything fades except a small tick on the box's corner. Nothing is left floating.
- **Dose change (stretch):** pinching the card makes only the Thursday to Sunday morning cells pulse orange with "-1 amlodipine". I take those pills out and pinch Done, and the box is right again without re-checking the whole week.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Pinching the metformin bottle lights exactly its 14 cells with "1", dims all the others, and shows its card above the box.
2. Pinching Done fades the glow, plays a chime, fills that bottle's dot and ticks the bottle; pinching Undo instead clears the selection without marking anything done.
3. Pinching the furosemide bottle lights only the Monday, Wednesday and Friday morning cells, each with "½" and a half-pill icon, and those three day labels brighten.
4. With only the vitamin D left and out of view, a chime plays from the left and an arrow points toward the shelf; after it's done, check mode shows every cell's expected pills and total, and pinching "All checked" shows "Week ready".
5. **(stretch)** Pinching the "Doctor's change" card makes only the Thursday to Sunday morning cells pulse orange with "-1 amlodipine".

**Build order:** get criteria 1 to 4 working and tested first. Only then add the dose change as a second pass. It belongs in the demo video if it works.

## Out of scope
- Real label reading and real box detection. The pinch-the-bottle stand-in replaces both; everything after recognition is built for real.
- Remembering anything between sessions. Each run starts with an empty box.
- Real medication data of any kind. The five bottles and their schedules are hard-coded sample data.
- Two people sharing the Lens, and anything that records, identifies or follows a person.
- Any custom gesture. Every interaction is a standard SIK pinch on a big target.

## Risks and open questions
- The out-of-view flow — chime, turn left, pinch, turn back — is the part the preview can only approximate. The logic is testable; whether the turn feels natural is **feel unproven** until it runs on real glasses.
- Whether a 2 cm count above a 3 cm cell reads comfortably at 60 cm, and whether 14 lit rings read as a pattern rather than clutter, is also **feel unproven**. Walk around it in the preview and judge.
- The dose-change mode is a stretch goal and may not land if the build runs long.
- This is a design demo, not a medical device. On a real box the printed prescription list stays the source of truth; nothing here should be used for real dosing without clinician-verified data.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
