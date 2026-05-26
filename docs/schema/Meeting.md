---
title: Meeting
type: schema
permalink: screeps-client/schema/meeting
entity: Meeting
version: 1
schema:
  topic: string, what was discussed
  date: string, when it happened (YYYY-MM-DD)
  attendees?(array): Person, who attended
  decisions?(array): string, decisions made
  action_items?(array): string, follow-up tasks
  status?(enum):
  - scheduled
  - completed
  - cancelled
  meeting_state?: string, current state of the meeting
settings:
  validation: warn
tags:
- schema
- meeting
---

# Meeting

Schema for meeting notes.

## Observations
- [convention] Meeting notes live in memory/meetings/ or as daily entries
- [convention] Always include date and topic
- [convention] Action items should become tasks when complex
- [best-practice] Tag attendees using relations to Person notes
- [best-practice] Include decisions as bullet points for easy scanning