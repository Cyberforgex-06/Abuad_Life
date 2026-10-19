# People and campus events

This update expands the single-player stories for Tomi, Dami and Zara. These are fictional adult characters, separate from live player profiles and chat.

## Conversations and dating

- **People & stories** shows friendship and trust. **My people** on the student phone includes conversations, optional relationships, date plans and shared memories.
- Each character offers three rotating conversation scenes. Listening, working together and honestly setting a time boundary have different time costs and rewards. A character can be spoken to once per game day.
- Existing friendships seed trust without changing the original friendship score. A mutual agreement to date requires friendship 3 and trust 40. Only one relationship can be active.
- Plan a date for the next day near Caf 1, arriving between 18:00 and 19:00. A date takes one hour. Choose a free catch-up, a ₦300 shared treat or a ₦600 treat for both. All give the same trust reward; payment happens only when attending.
- Cancelling ahead has no penalty. Missing a plan costs 8 trust and 4 mood, once. Ending a relationship preserves friendship, clears the date, and costs 5 trust and 3 mood.
- Relationships and recent memories carry across semesters. Daily interactions reset with the ordinary game day.

## Event calendar

| Day | Event | Time | Venue |
| --- | --- | --- | --- |
| 5 | Law Pride Week opening afternoon | 16:00–19:00 | College of Law |
| 12 | Engineering makers afternoon | 14:00–18:00 | College of Engineering |
| 19 | Alfa Belgore social night | 18:00–21:00 | Alfa Belgore Hall |
| 24 | SRC forum and simulated election | 14:00–18:00 | White Rock |

Each event takes one hour, accepts players from any department, and allows one visit per semester. Friends at level 2 or above can accompany the player. Every event includes a free option. Invalid, unaffordable or repeated actions consume no time or money. Curfew and transport rules still apply.

The SRC vote is a scripted single-player election between two fictional candidates. Results appear on day 25. It is not connected to real votes, university leadership or other online players.

Progress is stored under `state.student.stories` inside the existing cloud-save payload. No schema migration, account reset or credentials change is required.

Validation: `npm test` includes conversation limits, relationship gates, free/paid date reward parity, cancellation and missed-plan recovery, event venue/time/cost guards, companion eligibility, one vote per semester, legacy-save migration and semester persistence. Automated visual browser QA remains unavailable in this environment.
