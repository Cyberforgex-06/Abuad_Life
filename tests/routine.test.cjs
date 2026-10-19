const assert=require('assert'),{create}=require('./geography.test.cjs'),{validSave}=require('../save-validation');
const {run,nodes}=create(null,['routine.js']);
const reset=()=>run("state=fresh('Student','Computer Science','🧑🏾‍🎓');selected='hostel';tab='life';ensureRoutine();render()");
reset();assert.equal(run('formatGameTime(8.5)'),'08:30');assert.equal(run('formatGameTime(21.75)'),'21:45');assert(nodes['#routineSummary'].innerHTML.includes('Register'));
run('registerRoutineCourse(0);registerRoutineCourse(0)');assert.equal(run('ensureRoutine().registered.length'),1);
run("selected='lecture';travel('walk');attendRoutineClass()");assert.equal(run('state.hour'),10);assert.equal(run('state.attendance'),1);assert.equal(run('ensureJourney().mastery[0]'),7);run('attendRoutineClass()');assert.equal(run('state.attendance'),1);
// Late, unregistered, wrong college and weekend lectures do not consume resources.
for(const setup of ["state.hour=9", "state.location='law';state.hour=8.5", "state.day=6;state.hour=8.5"]){reset();run("registerRoutineCourse(0);state.location='lecture';"+setup);const before=run('JSON.stringify([state.hour,state.energy,state.attendance])');run("attendRoutineClass();act('lecture')");assert.equal(run('JSON.stringify([state.hour,state.energy,state.attendance])'),before)}
reset();run("state.hour=8.5;state.location='lecture';attendRoutineClass()");assert.equal(run('state.attendance'),0);
// Ride availability is deterministic, failures atomic, and all travel modes have their advertised costs.
for(const mode of ['walk','shuttle','scoot']){reset();run("selected='library';while(!routineTrip('"+mode+"').available)state.hour+=.25");const start=run('state.hour');run("travel('"+mode+"')");assert.equal(run('state.hour'),start+(mode==='walk'?.5:.25));assert.equal(run('state.money'),12000-(mode==='walk'?0:mode==='shuttle'?150:250))}
reset();run("selected='library';while(routineTrip('shuttle').available)state.hour+=.25");const cash=run('state.money'),hour=run('state.hour');run("travel('shuttle');travel('shuttle')");assert.equal(run('state.money'),cash);assert.equal(run('state.hour'),hour);
reset();run("state.location='lecture';state.hour=8.5;selected='hostel';travel('walk')");assert.equal(run('state.location'),'lecture');run("state.hour=11.5;travel('walk')");assert.equal(run('state.location'),'hostel');assert.equal(run('state.hour'),12);
reset();run("state.hour=9;studentCare('shower')");assert.equal(run('state.hour'),9);run("selected='library';travel('walk')");assert.equal(run('state.location'),'library');
// Curfew cannot strand the player, medical help has no fee or conduct penalty.
reset();run("state.location='lecture';state.hour=21.75;selected='hostel';travel('walk')");assert.equal(run('state.location'),'lecture');run('routineAssistedReturn();routineAssistedReturn()');assert.equal(run('state.hour'),22);assert.equal(run('state.location'),'hostel');assert.equal(run('ensureRoutine().conduct.length'),1);assert.equal(run('state.mood'),67);
run('endDay();document.querySelector("#confirmSleep").onclick()');assert.equal(run('state.day'),2);assert.equal(run('state.hour'),8);
reset();run("state.location='library';state.hour=22;state.energy=5;routineMedicalHelp();routineAssistedReturn()");assert.equal(run('state.money'),12000);assert.equal(run('state.energy'),40);assert.equal(run('state.location'),'hostel');assert.equal(run('ensureRoutine().conduct.length'),0);assert.equal(run('state.hour'),22);
// Quiz state survives serialization; stale/double answer callbacks cannot award twice.
reset();run("ensureRoutine().registered=[0,1,2];state.location='lecture';state.day=8;state.hour=8.5;attendRoutineClass()");assert(run('!!ensureRoutine().pending'));const snapshot=run('JSON.stringify(state)');assert(validSave(JSON.parse(snapshot)));const resumed=create(snapshot,['routine.js']);resumed.run('answerRoutineAssessment(QUIZ_BANK[ensureRoutine().pending.questions[0]].correct,0)');assert.equal(resumed.run('ensureRoutine().quizzes[8].score'),1);const knowledge=resumed.run('state.knowledge');resumed.run('answerRoutineAssessment(0,0)');assert.equal(resumed.run('state.knowledge'),knowledge);assert.equal(resumed.run('ensureRoutine().pending'),null);
// Final assessment records each answer once, with persisted progress and bounded rewards.
reset();run("ensureRoutine().registered=[0,1,2];state.day=28;state.location='lecture';beginRoutineExam();answerRoutineAssessment(QUIZ_BANK[ensureRoutine().pending.questions[0]].correct,0);answerRoutineAssessment(0,0)");assert.equal(run('ensureRoutine().pending.answers.length'),1);run('for(let i=1;i<3;i++)answerRoutineAssessment(QUIZ_BANK[ensureRoutine().pending.questions[i]].correct,i)');assert.equal(run('ensureRoutine().exam.score'),3);assert.equal(run('state.knowledge'),24);run('beginRoutineExam()');assert.equal(run('state.hour'),9);
// Older saves keep their balance and academic progress; a new semester resets just the new term data.
reset();run('state.money=8765;state.attendance=7;delete state.student.routine;ensureRoutine()');assert.equal(run('state.money'),8765);assert.equal(run('state.attendance'),7);run('registerRoutineCourse(0);ensureJourney().semester=2;ensureRoutine()');assert.equal(run('ensureRoutine().registered.length'),0);assert.equal(run('state.money'),8765);assert.equal(run('routineCourses()[0].code'),'CSC 102');
// The ordinary end-day action cannot silently teleport players home.
reset();run("state.location='library';endDay()");assert(nodes['#modal'].innerHTML.includes('Make your way home'));assert.equal(run('state.location'),'library');
console.log('Passed: course registration, minute clock, timetable windows, lecture limits, transport costs/availability, hostel boundaries, curfew recovery, medical returns, resumable assessments, reward guards, save compatibility and semester reset.');
// All eight semesters remain completable with the new rules and ordinary controls.
reset();run(`for(let term=1;term<=8;term++){
 for(let i=0;i<3;i++)registerRoutineCourse(i);
 for(let d=1;d<=28;d++){
  selected=academicBuilding();travel('walk');if(routineClass())attendRoutineClass();
  if(d===28)beginRoutineExam();
  while(ensureRoutine().pending){const p=ensureRoutine().pending;answerRoutineAssessment(QUIZ_BANK[p.questions[p.answers.length]].correct,p.answers.length)}
  studyCourse(0);while(state.hour<11.5)waitRoutine();
  selected='hostel';travel('walk');endDay();document.querySelector('#confirmSleep').onclick();
 }
 if(term<8){startNextSemester();document.querySelector('#confirmNextSemester').onclick()}
}`);assert.equal(run('ensureJourney().transcript.length'),8);assert.equal(run('ensureRoutine().term'),8);assert.equal(run('ensureRoutine().exam.score'),3);assert(run('state.finished'));assert(validSave(JSON.parse(run('JSON.stringify(state)'))));
console.log('Passed: 224 days through scheduled classes, assessments, hostel returns, semester transitions and a valid cloud-save payload.');
