## Project Configuration

- **Language**: TypeScript
- **Package Manager**: npm
- **Add-ons**: none

---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

This is a new fitness tracker project. The codebase does not yet exist — update this file once a stack is chosen and the project is initialized.

### Requirements

Web app to track my training progress. Main view should have a calendar view and a day can be highlighted with custom colored if I train that day.
Example: Blue: weight-lifting, Red: Boxing training
Multiple colors can be added to a single day.

The main view should also have a text sections that user can put the training schedules, quotes,... (Markdown would be appreciated)

When a day is picked, a day view should be open where I can set the trainings I did, a note area to jot down anything like my own weight, my PR that day,...

There should also be a navigation bar on the left side, new features / screens will be added later

Mobile friendly as I will mostly update my progress through phone

### Stack

You can select the UI framework, I want it fast on browser side

User must authenticase to access the app
Use Firebase for authentication & firestore for data storing

Webapp will be deployed on cloudflare, I'll handle that part
