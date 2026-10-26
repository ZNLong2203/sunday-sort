# Evidence behind Sunday Sort

The numbers and prior work the design brief relies on, with sources. Each source was opened and read before being cited here.

## Who fills the pillbox

- **82% of family caregivers who perform medical or nursing tasks manage medications**, the most common of those tasks. AARP Public Policy Institute and United Hospital Fund, *Home Alone Revisited: Family Caregivers Providing Complex Care*, April 2019, a survey of 2,089 family caregivers. [Press release](https://www.aarp.org/press/releases/2019-4-17-aarp-20-million-family-caregivers-performing-complex-medical-nursing-tasks)

## How often it goes wrong

- **60% of paid home caregivers made errors sorting medications into pillboxes** in a Northwestern University study of nearly 100 paid, non-family caregivers in the Chicago area (Lindquist et al., *Journal of General Internal Medicine*, 2011). [Northwestern news release, 28 February 2011](https://news.feinberg.northwestern.edu/2011/02/28/seniors_caregivers)

These caregivers were paid, not family members, and the sample was small. We cite it for what it shows: sorting a week of pills into a box is error-prone even for people who do it as a job.

## Prior work, and how Sunday Sort differs

- **Blusi and Nieves (2019)** built a Medication Coach agent on a Microsoft HoloLens that guided **patients** while they filled their own pillbox. With 15 participants aged 17 to 76 it was "feasible and acceptable", but people older than 65 felt less comfortable with the headset and were more hesitant to use it. *Feasibility and Acceptability of Smart Augmented Reality Assisting Patients with Medication Pillbox Self-Management*, MEDINFO 2019, Studies in Health Technology and Informatics 264: 521–525. [PDF](https://ebooks.iospress.nl/pdf/doi/10.3233/SHTI190277)

Sunday Sort takes the same task in a different direction:

| | Medication Coach (2019) | Sunday Sort |
|---|---|---|
| Who wears the device | The patient | The caregiver who fills the box for them |
| Unit of guidance | Steps of the prescription | The bottle in your hand: its cells light up on the box |
| After filling | — | A check pass: every cell shows what should be in it |
| When the prescription changes | — | Only the cells that change light up (stretch goal) |

Putting the glasses on the caregiver also sidesteps the hesitancy the 2019 study saw in older users.

## The sample week in the Lens

The five bottles and their schedules (metformin, amlodipine, furosemide, atorvastatin, vitamin D) are **fictional sample data** chosen to cover the hard cases: twice daily, morning only, evening only, half a tablet on some days, and once a week. They are not a real patient's prescription and not medical advice. On a real box, the printed prescription list stays the source of truth.
