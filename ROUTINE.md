# Campus routine update

Open **Campus day** from the dashboard or student phone.

- Register three fictional department course pathways each semester, at no cost.
- Weekday lectures start at 08:30, admit students through 08:45, and end at 10:00. The assigned course rotates; weekends have no scheduled lectures.
- Attend at your department's college. Each lecture adds attendance, knowledge and course mastery once. Independent study remains in My journey after missed classes.
- Some classes include a surprise study-skills question. The draw is stable for that game day. Answers and unfinished assessments persist in the same account save as the game.
- Day 28 offers a three-question, one-hour final assessment at your college. It rewards knowledge and mastery; finishing the semester without taking it remains possible.
- Walking costs 30 minutes and 5 energy. Shuttle rides cost 15 minutes, 1 energy and ₦150; ScootEasy costs 15 minutes, 2 energy and ₦250. Ride availability changes every 15 game minutes. Failed journeys charge nothing.
- Hostel entry and indoor activities close from 09:00 to 12:00. Departure remains possible. Trips must arrive by 22:00, and players return to a hostel before ending the day.
- When a normal return is impossible because of energy or curfew, assisted return costs 8 mood and 2 reputation, with no virtual fee. At energy 15 or lower, a free medical shuttle/rest event is available once per day; it includes an optional free return from the hospital, including at curfew.

All schedules, courses, fares, availability and access rules are fictional simulation mechanics, not university policy or real route estimates. Assessments use general study-skills questions, not official exam material.

Existing balances, inventories, friends, academic progress and transcripts are preserved. New routine records live under `state.student.routine` and reset with semester rollover. No account/database reset or additional database tables are needed.

Verification: `npm test` covers auth/cloud-save regressions and the routine. The routine suite exercises boundary times, failed-ride atomicity, saved quiz continuation, repeat-reward guards, old-save migration and all 224 days/eight semesters.
