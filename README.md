# VitalLens

**Source-available for evaluation only. Not open source. All rights, including patent rights, are reserved; see [LICENSE](LICENSE).**

VitalLens is a SPECS Lens for a bedside nursing round in a fictional hospital ward. It was built for the [Learn AR with SPECS](https://learn-specs.devpost.com/) hackathon with Lens Studio, the SPECS Interaction Kit and UI Kit, and CLAD through the Lens Studio MCP.

Everything in it is fictional. Patient identification, dictation, AI drafting, vitals and filing are simulated with fixed sample data and labelled as simulated where they appear. There is no real patient data, face recognition, live capture, hospital or EHR connection, or treatment advice. It is not a medical device, and no clinical benefit or validation is claimed.

## What it shows

A nurse works a fictional ward round:

- checks that the right patient is in the bed before anything patient-specific opens;
- reads a patient overview beside the bed;
- dictates a note (sample transcript), reviews a simulated AI draft and deliberately saves it for later review;
- responds to a simulated Code Blue drill at another bed;
- reviews a handover summary.

Nothing is approved or filed by navigation or a timer, and unknown facts stay marked as unknown.

## Earlier work and how it was built

The concept comes from an NTU DR5004 course project (June to July 2026) and HTML storyboards made on 1 and 2 November 2026. No code, presentations or research documents from that earlier work are included. The Lens itself was built new during the hackathon submission period with coding agents (Kiro and Claude Code) working through CLAD and the Lens Studio MCP, on the SPECS Base Template. Third-party components are listed below.

## Run it

1. Install Lens Studio 5.24 or later with SPECS support, plus Git LFS.
2. Clone the repository with Git LFS so the assets download.
3. Open `SpecsBaseTemplate.esproj` in Lens Studio and let the packages import.
4. Optional: to show the ward around you, run `python tools/build_ward_preview_source.py` (Python 3.10 or later). Then in Preview choose Interactive > From Lens Folder > `demo/ward/preview-source`.
5. Use Interactive Preview. A click acts as a pinch. Move with WASD, Q and E, and right-drag to look around.

The official Devpost Learn `plan-lens` skill pack is included in [`.agents/skills/plan-lens`](.agents/skills/plan-lens). The team did not run its live interview. The team's coding agent wrote the design brief from the owner's written answers, following the pack's design-brief template, and the owner reviewed and approved it. The brief and planning notes are kept private.

## Licence and third-party components

The VitalLens team's own work is under the evaluation-only [LICENSE](LICENSE). The SPECS starter template (MIT), packages, fonts (SIL OFL 1.1) and icons (Apache 2.0) keep their own licences. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [`licenses/`](licenses/).
