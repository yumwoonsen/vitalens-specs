---
status: approved
---

# Design brief: VitalLens (public version)

> **Provenance.** This is the public version of the team's design brief. It follows the official `plan-lens` design-brief template. The team did not run the skill's live interview. The team's coding agent (Kiro) wrote the brief on 1 November 2026 from the owner's written answers and the team's storyboards, and the owner reviewed and approved it at gate G2 the same day. The brief was amended on 2 November for the bedside redesign. Internal planning notes, owner quotes and detailed layout values are kept private. Values marked `(default)` follow Snap's SPECS design guidance, not an owner choice. Research behind the idea: one informal conversation with a ward nurse in July 2026. It showed interest, not demand, and it validates nothing.

> **Current design (amendment, 2 November 2026).** The owner approved a bedside redesign around a compact patient overview beside the bed, with a routine encounter at Bed 2 interrupted by a Code Blue drill at Bed 3. A hospital ward model replaces the default preview room as preview scenery only; on glasses the ward is the real room, not AR content. The sections below are the approved brief; where they differ, the amendment wins.

## The one spatial moment
A nurse at the bedside checks the patient's wristband and, once the right patient is confirmed, sees the records and current status that matter, beside the bed. Before that, across the ward, a small marker over each assigned bed shows what that patient needs next.

The demo keeps a seven-phase walkthrough around this moment: Boot, Clock in, Identify, Routine round, Review and save, Emergency, Handover. There are two modes: **Routine** (nurse-paced) and **Emergency** (red, glance only).

## Why it belongs on glasses
- Uses: it draws in the world (records beside the bed, markers over beds) and leaves the nurse's hands free for care.
- Why it might be better than a phone or ward computer: the nurse can reach the information at the bedside without going back and forth to a workstation. This is a hypothesis. Phones, tablets, ward computers and dictation tools are fair alternatives, and the advantage is unproven.
- Division of work: the glasses are for reading, identifying and capturing at the bed. Review, editing and signing happen on the ward's computer on wheels (COW), not on the glasses.

## Product or overlay
- Type: overlay. It responds to a patient's wristband and the beds of an assigned ward.
- What a real version would sense: the patient's wristband. The bed number is never a patient identifier. There is no face recognition.
- Stand-in for the preview: a virtual wristband on a fictional patient. A "Scan wristband (simulated)" button reads it, then the nurse confirms name and date of birth before any patient-specific action unlocks. A second demo button shows the mismatch stop and recovery.
- Everything is fictional. The Lens shows one "Simulated" disclosure at the start, and each simulated capability carries its own label: wristband scan, dictation transcript, AI draft, emergency vitals playback and handover.

## Where things live
- The main task happens at the bed: panels sit beside the patient, world-locked, not over the patient's head or face, and not stuck to the nurse's view `(default)`.
- While walking, only a short status strip stays near the top edge of the view, leaving the central and lower view clear `(default)`.
- Light text on dark backing plates throughout, because the display is additive and black shows as see-through. Colour always comes with an icon or a word.

## Hands and input
- Every action is a pinch on a UI Kit button `(default)`, so the whole flow works with a mouse in Interactive Preview.
- Voice lines (scan, start and stop a note, read back, Code Blue, privacy) each have a button that does the same job. Nothing to do with medication is done by voice.
- Next, Back and timers never save, sign or file anything. Switch patient and Reset need a confirmation.

## When things show
- The disclosure shows at Boot and hides after "Begin demonstration".
- The identity check appears whenever the patient is not verified. A mismatch shows a red "ID mismatch, stop" and blocks patient actions until a valid rescan.
- After verification, a short patient summary is always visible; detail opens one card at a time.
- Note capture is push-to-talk, with a recording indicator only while recording. Stopping gives a sample transcript and a labelled simulated AI draft marked "Pending review". The nurse corrects or rejects it and deliberately saves it for review on the COW. Nothing claims the note was filed or signed.
- Emergency (a simulated Code Blue drill) shows critical information with fixed sample values marked "Sample, not live" and their time. Closing it does not change the note history.
- The handover summary is built only from saved notes, shows its sources and the pending tasks with an owner, and is reviewed separately. Editing a note marks it stale.
- Privacy stops capture, hides patient details and never restarts capture on its own.

## Done criteria
Each can be checked in Lens Studio's preview.
1. After Reset, Boot shows the "Simulated" disclosure, and Clock in shows the ward with each bed's needs and no names.
2. Scanning the wristband and confirming two identifiers verifies the patient. The mismatched wristband shows "ID mismatch, stop" and blocks patient actions until a valid rescan.
3. Once verified, the patient summary is visible without an extra step. A note can only start after consent, and privacy stops capture.
4. The seeded draft error can be corrected or the draft rejected. Only a deliberate save marks it "pending review on COW". Navigation and waiting never change it.
5. Emergency shows critical information where every value has a source and time or "Unknown". Closing it leaves the note history unchanged.
6. The handover lists only saved-note content with sources and pending tasks with owners. Editing the note marks it stale.
7. Switch patient or Reset clears the encounter.
8. Every voice line has a matching button, and no medication action is available by voice.

## Out of scope
- Face recognition; real patients, records or identifiers; live ward or camera capture.
- Real EHR access, a real COW or hospital login, a backend, a live AI pipeline, or sending a handover to another nurse.
- Live monitoring, treatment advice, calculated scores or random values.
- Any claim of clinical validation, efficiency, safety or regulatory compliance.

## Risks and open questions
- Seven phases are a lot for one moment. The wristband check and bedside overview stay the hero of the video.
- Voice may not work in the preview, so buttons carry every voice action.
- Comfort, text size, reach and walking safety can only be judged on real glasses. The preview shows logic and placement only.
- The advantage over a phone or ward computer is a hypothesis.

## Build notes for CLAD
- Build for SPECS so it runs in Lens Studio's preview. No SPECS device was available.
- Use the SPECS Interaction Kit and UI Kit for all interactions, so they work in Interactive Preview and with LEAF.
- Use real-world scale in centimetres, light text on backing plates, and keep content in view during the main task.
- Get the basic flow working first, then add detail. Write LEAF scenarios for the done criteria and report which pass.
- Don't record, identify or follow people.
