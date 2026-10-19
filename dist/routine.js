'use strict';
// Fictional rules for the simulation; these are not an official university timetable.
function ensureRoutine(){
 if(!state)return null;
 const s=ensureStudentState(),term=ensureJourney().semester;
 if(!s.routine||s.routine.term!==term)s.routine={term,registered:[],attendance:{},quizzes:{},pending:null,exam:null,conduct:[],medicalDays:[]};
 return s.routine;
}
function routineCourses(){
 const prefix=({'Computer Science':'CSC',Engineering:'ENG',Medicine:'MED',Nursing:'NUR',Law:'LAW',Pharmacy:'PHA',Agriculture:'AGR','Business Administration':'BUS'})[state.course]||'ASC';
 const j=ensureJourney(),level=Math.ceil(j.semester/2)*100;
 return courseTopics().map((title,index)=>({index,title,code:prefix+' '+(level+index*2+(j.semester%2?1:2)),place:academicBuilding()}));
}
function routineClass(day=state.day){return day===28||(day-1)%7>=5?null:routineCourses()[(day-1)%3]}
function routineClassStatus(day=state.day){
 const r=ensureRoutine(),c=routineClass(day);
 if(day===28)return 'Final assessment';
 if(!c)return 'Weekend · no scheduled class';
 if(r.attendance[day]!==undefined)return 'Attended ✓';
 if(day<state.day||(day===state.day&&state.hour>8.75))return 'Missed · revise in My journey';
 return r.registered.includes(c.index)?'Registered · 08:30–10:00':'Register this course';
}
function registerRoutineCourse(index){
 const r=ensureRoutine();if(state.finished||!Number.isInteger(index)||!routineCourses()[index]||r.registered.includes(index))return;
 r.registered.push(index);studentCommit('Registered '+routineCourses()[index].code+' for this semester.','routine');
}
function attendRoutineClass(){
 const r=ensureRoutine(),c=routineClass();if(state.finished)return;
 if(r.pending){drawRoutineAssessment();return}
 if(!c){toast('No scheduled lecture today. Use My journey for independent study.');return}
 if(!r.registered.includes(c.index)){toast('Register this course in Campus day first.');openStudentPhone('routine');return}
 if(state.location!==c.place){toast('Travel to '+places.find(p=>p.id===c.place).name+' for your class.');return}
 if(r.attendance[state.day]!==undefined||state.daily.lecture){toast('Today’s lecture is already recorded.');return}
 if(state.hour<8.5){toast('Class begins at 08:30. Wait using Campus day.');return}
 if(state.hour>8.75){toast('The 08:45 admission window has closed. Independent study is still available.');return}
 if(!studentSpendTime(10-state.hour,-12))return;
 r.attendance[state.day]=c.index;state.daily.lecture=true;state.attendance++;state.knowledge=clamp(state.knowledge+8);
 const j=ensureJourney();j.mastery[c.index]=clamp((j.mastery[c.index]||0)+7);
 if(!state.visits.includes(c.place))state.visits.push(c.place);state.actions.push('scheduled_lecture');
 // A stable day/term draw cannot be rerolled by reopening the phone or refreshing.
 const surprise=(state.day*7+r.term*3+c.index)%4===0;
 if(surprise&&!r.quizzes[state.day])r.pending={kind:'quiz',day:state.day,course:c.index,answers:[],questions:[(state.day+c.index)%QUIZ_BANK.length]};
 studentCommit('Attended '+c.code+' · course mastery +7.','routine');
 if(r.pending)drawRoutineAssessment();
}
function waitRoutine(){
 if(studentSpendTime(.25,0))studentCommit('Waited 15 game minutes.','routine');
}
function beginRoutineExam(){
 const r=ensureRoutine();if(state.finished||state.day!==28||r.exam)return;
 if(r.pending){drawRoutineAssessment();return}
 if(r.registered.length!==3){toast('Register all three courses before your final assessment.');return}
 if(state.location!==academicBuilding()){toast('Travel to your college for the final assessment.');return}
 if(!studentSpendTime(1,-8))return;
 r.pending={kind:'exam',day:28,course:null,answers:[],questions:[0,1,2].map(i=>(r.term+i)%QUIZ_BANK.length)};
 log('Started the semester’s fictional study-skills assessment.');save();render();drawRoutineAssessment();
}
function drawRoutineAssessment(){
 const p=ensureRoutine().pending;if(!p)return;
 const q=QUIZ_BANK[p.questions[p.answers.length]];
 show(`<div class="eyebrow">${p.kind==='exam'?'FINAL ASSESSMENT':'SURPRISE CLASS QUIZ'} · ${p.answers.length+1} / ${p.questions.length}</div><h2>${escapeHtml(q.q)}</h2><p>A fictional study-skills check. Each answer is saved; you can resume from Campus day.</p>${q.a.map((a,i)=>`<button class="secondary" data-routine-answer="${i}">${escapeHtml(a)}</button>`).join('')}<button class="text-button" id="pauseRoutineQuiz">Save & finish later</button>`);
 const expected=p.answers.length;
 document.querySelectorAll('[data-routine-answer]').forEach(b=>b.onclick=()=>answerRoutineAssessment(Number(b.dataset.routineAnswer),expected));
 $('#pauseRoutineQuiz').onclick=()=>openStudentPhone('routine');
}
function answerRoutineAssessment(answer,expected){
 const r=ensureRoutine(),p=r.pending;if(state.finished||!p||p.answers.length!==expected||!Number.isInteger(answer))return;
 const q=QUIZ_BANK[p.questions[expected]];if(!q||answer<0||answer>=q.a.length)return;
 p.answers.push(answer);
 if(p.answers.length<p.questions.length){save();drawRoutineAssessment();return}
 const score=p.answers.reduce((n,a,i)=>n+(a===QUIZ_BANK[p.questions[i]].correct?1:0),0);
 const result={score,total:p.questions.length,day:p.day};
 if(p.kind==='exam')r.exam=result;else r.quizzes[p.day]=result;
 state.knowledge=clamp(state.knowledge+score*3);const j=ensureJourney();
 for(const i of p.kind==='exam'?r.registered:[p.course])j.mastery[i]=clamp((j.mastery[i]||0)+score*2);
 const label=p.kind==='exam'?'Final assessment':'Surprise class quiz';r.pending=null;
 studentCommit(label+': '+score+'/'+result.total+' correct. Answers recorded.','routine');
}
function routineTrip(mode,destination=selected){
 const p=places.find(x=>x.id===destination),options={walk:{hours:.5,energy:-5,cost:0,label:'Walk'},shuttle:{hours:.25,energy:-1,cost:150,label:'Shuttle'},scoot:{hours:.25,energy:-2,cost:250,label:'ScootEasy'}};
 if(!p||!options[mode])return null;
 const trip={...options[mode],destination:p.id,available:true,reason:''},arrival=state.hour+trip.hours;
 if(state.finished){trip.available=false;trip.reason='Semester complete'}
 else if(state.location===p.id){trip.available=false;trip.reason='Already here'}
 else if(arrival>22){trip.available=false;trip.reason='Arrival after 22:00 curfew'}
 else if(p.type==='hostel'&&arrival>=9&&arrival<12){trip.available=false;trip.reason='Hostel entry closed 09:00–12:00'}
 else if(mode!=='walk'&&(state.day*3+Math.floor(state.hour*4)+(mode==='scoot'?2:0)+ensureJourney().semester)%5<2){trip.available=false;trip.reason='No ride this quarter-hour'}
 else if(state.money<trip.cost){trip.available=false;trip.reason='Not enough virtual naira'}
 else if(state.energy+trip.energy<5){trip.available=false;trip.reason='Not enough energy · request assistance'}
 return trip;
}
travel=function(mode){
 const trip=routineTrip(mode);if(!trip)return;
 if(!trip.available){toast(trip.reason);return}
 // Leaving a closed hostel is allowed; only arrival and indoor activities are restricted.
 state.hour+=trip.hours;state.money-=trip.cost;state.energy=clamp(state.energy+trip.energy);state.hunger=clamp(state.hunger-trip.hours*2);state.location=trip.destination;
 studentCommit('Travelled by '+trip.label+' to '+places.find(p=>p.id===trip.destination).name+'.');
};
function routineTravelContent(p){
 return `<div class="travel-box"><b>Choose your ride</b><div>${['walk','shuttle','scoot'].map(mode=>{const t=routineTrip(mode,p.id);return `<button class="secondary" data-routine-travel="${mode}" ${t.available?'':'disabled'}>${t.label} · ${t.hours*60} min · ${t.cost?money(t.cost):'free'}<small>${t.available?'Arrive '+formatGameTime(state.hour+t.hours)+' · '+t.energy+' energy':t.reason}</small></button>`}).join('')}</div><button class="text-button" data-routine-open>Wait or request assistance →</button><small>Game fares and durations, not real route estimates. Ride availability changes every 15 game minutes.</small></div>`;
}
function bindRoutineTravel(){
 document.querySelectorAll('[data-routine-travel]').forEach(b=>b.onclick=()=>travel(b.dataset.routineTravel));
 document.querySelectorAll('[data-routine-open]').forEach(b=>b.onclick=()=>openStudentPhone('routine'));
}
const routineBaseCheckTime=checkTime;
checkTime=function(hours,energy=0,cost=0){
 if(hours>0&&isHostel()&&state.hour<12&&state.hour+hours>9){toast('Hostels close for activities from 09:00 to 12:00. Head out to campus first.');return false}
 return routineBaseCheckTime(hours,energy,cost);
};
const routineBaseAct=act;
act=function(id){const p=places.find(p=>p.actions.some(a=>a[0]===id)),a=p?.actions.find(a=>a[0]===id);if(!a)return;if(a[5].attendance){attendRoutineClass();return}routineBaseAct(id)};
function routineAssistedReturn(){
 const r=ensureRoutine();if(state.finished||isHostel())return;
 if(r.medicalDays.includes(state.day)&&state.location==='hospital'){state.hour=Math.min(22,state.hour+.25);state.location='hostel';selected='hostel';studentCommit('A free medical return brought you safely back to your hostel.','routine');return}
 const ordinary=routineTrip('walk','hostel');
 if(ordinary.available){toast('You can still walk home. Select your hostel and travel back.');return}
 if(state.hour<12&&state.hour+.5>=9){toast('Hostel entry reopens at 12:00. Wait on campus or continue your activities.');return}
 if(r.conduct.includes(state.day))return;
 r.conduct.push(state.day);state.hour=Math.min(22,state.hour+.5);state.location='hostel';selected='hostel';state.mood=clamp(state.mood-8);ensureStudentState().reputation=Math.max(0,ensureStudentState().reputation-2);
 studentCommit('Requested an assisted hostel return. −8 mood, −2 reputation; plan tomorrow’s return before curfew.','routine');
}
function routineMedicalHelp(){
 const r=ensureRoutine();if(state.finished||state.energy>15||r.medicalDays.includes(state.day)){toast('The game medical shuttle is available once a day when energy is 15 or lower.');return}
 r.medicalDays.push(state.day);state.hour=Math.min(22,state.hour+1);state.energy=clamp(state.energy+35);state.location='hospital';selected='hospital';
 studentCommit('A free game medical shuttle took you to the hospital for rest. +35 energy. This is a fictional wellbeing event.','routine');
}
const routineBaseEndDay=endDay;
endDay=function(){
 if(state.finished){routineBaseEndDay();return}
 if(!isHostel()){
  show(`<div class="eyebrow">BEFORE YOU SLEEP</div><h2>Make your way home.</h2><p>Return to a hostel before ending the day. Curfew is 22:00. If you cannot get back in time or have run out of energy, request an assisted return in Campus day.</p><button class="primary" id="findRoutineHostel">Find my hostel</button><button class="secondary" id="openRoutineHelp">Open Campus day</button>`);
  $('#findRoutineHostel').onclick=()=>{close();tab='campus';selectPlace('hostel')};$('#openRoutineHelp').onclick=()=>openStudentPhone('routine');return;
 }
 if(state.hour>=9&&state.hour<12){toast('Hostels are closed until 12:00. Head out to campus.');return}
 routineBaseEndDay();
};
$('#sleep').onclick=endDay;
function routineContent(){
 const r=ensureRoutine(),c=routineClass(),college=places.find(p=>p.id===academicBuilding()),weekStart=Math.floor((state.day-1)/7)*7+1;
 return `<div class="routine-today"><span class="eyebrow">DAY ${state.day} · ${formatGameTime(state.hour)}</span><h3>${c?escapeHtml(c.code)+' · 08:30':state.day===28?'Final assessment day':'A little breathing room.'}</h3><p>${c?escapeHtml(c.title)+'<br>'+escapeHtml(college.name):state.day===28?'A three-question study-skills assessment adds to your knowledge before results.':'No scheduled lectures. Make time for revision, friends or rest.'}</p><b>${routineClassStatus()}</b>${c?phoneButton('Attend scheduled class · until 10:00','id="attendRoutine"',state.finished||state.hour<8.5||state.hour>8.75||r.attendance[state.day]!==undefined):''}${phoneButton('Find '+college.name,`data-go="${college.id}"`)}${phoneButton('Wait 15 minutes','id="waitRoutine"',state.finished||state.hour>=22)}</div>
 ${r.pending?phoneButton('Resume '+(r.pending.kind==='exam'?'final assessment':'class quiz'),'id="resumeRoutine"'):''}
 ${state.day===28?phoneButton(r.exam?'Final assessment: '+r.exam.score+'/'+r.exam.total+' ✓':'Take final assessment · 1 hr','id="examRoutine"',state.finished||!!r.exam):''}
 <h3>Register your semester</h3><p class="phone-note">Free registration. Your department determines these fictional course pathways. Register each semester; independent study is in My journey.</p>${routineCourses().map(c=>`<div class="phone-row"><b>${escapeHtml(c.code)} · ${escapeHtml(c.title)}</b><small>Mastery ${ensureJourney().mastery[c.index]||0}% · ${Object.values(r.attendance).filter(i=>i===c.index).length} classes attended</small>${phoneButton(r.registered.includes(c.index)?'Registered ✓':'Register course',`data-register-course="${c.index}"`,state.finished||r.registered.includes(c.index))}</div>`).join('')}
 <h3>This week</h3><div class="routine-week">${Array.from({length:7},(_,i)=>weekStart+i).map(day=>{const c=routineClass(day);return `<div class="routine-day ${day===state.day?'today':''}"><b>Day ${day}${day===state.day?' · today':''}</b><span>${c?'08:30 · '+escapeHtml(c.code):day===28?'Final assessment':'Free day'}</span><small>${routineClassStatus(day)}</small></div>`}).join('')}</div>
 <h3>Getting around & getting home</h3><p class="phone-note">Walk: 30 min, free. Shuttle: 15 min, ₦150. ScootEasy: 15 min, ₦250. Select a map destination to see current availability.</p><div class="phone-banner"><b>Hostel entry & activities: closed 09:00–12:00</b><p>You can always leave. Arrive home by 22:00. These are simulation rules based on your game concept, not official campus guidance.</p>${phoneButton('Find my hostel','data-go="hostel"')}${phoneButton(r.medicalDays.includes(state.day)&&state.location==='hospital'?'Medical return to hostel · free':'Assisted return · −8 mood, −2 reputation','id="assistRoutine"',state.finished||isHostel()||(!(r.medicalDays.includes(state.day)&&state.location==='hospital')&&!!routineTrip('walk','hostel')?.available))}${phoneButton('Medical shuttle & rest · free · up to 1 hr','id="medicalRoutine"',state.finished||state.energy>15||r.medicalDays.includes(state.day))}<small>Medical help unlocks at energy 15 or below, once per game day, including after curfew. A fictional game event.</small></div>
 <h3>Academic record</h3><p>${Object.keys(r.attendance).length} scheduled classes · ${Object.keys(r.quizzes).length} surprise quizzes completed${r.exam?' · final assessment '+r.exam.score+'/'+r.exam.total:''}</p>${r.conduct.length?`<p class="phone-note">Assisted returns this semester: ${r.conduct.length}. No virtual fee is charged.</p>`:''}`;
}
PHONE_APPS.unshift(['routine','🗓️','Campus day','Registration, 08:30 classes & campus transport.']);
const routineBasePhoneContent=phoneAppContent;
phoneAppContent=function(app){return app==='routine'?routineContent():routineBasePhoneContent(app)};
const routineBaseBindPhone=bindPhone;
bindPhone=function(app){
 routineBaseBindPhone(app);if(app!=='routine')return;
 document.querySelectorAll('[data-register-course]').forEach(b=>b.onclick=()=>registerRoutineCourse(Number(b.dataset.registerCourse)));
 const actions={'#attendRoutine':attendRoutineClass,'#waitRoutine':waitRoutine,'#resumeRoutine':drawRoutineAssessment,'#examRoutine':beginRoutineExam,'#assistRoutine':routineAssistedReturn,'#medicalRoutine':routineMedicalHelp};
 for(const [selector,fn]of Object.entries(actions)){const node=$(selector);if(node)node.onclick=fn}
};
const routineBaseSave=save;
save=function(){if(state)ensureRoutine();routineBaseSave()};
const routineBaseRender=render;
render=function(){
 if(state)ensureRoutine();routineBaseRender();if(!state)return;
 const box=$('#routineSummary'),r=ensureRoutine(),c=routineClass();
 if(box){box.innerHTML=`<div><small>YOUR CAMPUS DAY</small><b>${state.finished?'Semester complete':r.pending?'An assessment is waiting for you':r.registered.length<3?'Register your semester courses':c?'08:30 · '+escapeHtml(c.code)+' · '+routineClassStatus():routineClassStatus()}</b><span>${state.hour>=21&&!isHostel()?'Curfew at 22:00 — plan your trip home.':'Hostels close 09:00–12:00 · curfew 22:00'}</span></div><button class="secondary" id="openRoutineSummary">Open Campus day →</button>`;$('#openRoutineSummary').onclick=()=>openStudentPhone('routine')}
};
if(state)render();
