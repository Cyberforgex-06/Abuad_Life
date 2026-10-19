'use strict';
// Single-player stories. These characters are fictional adults, not online players.
const CAMPUS_STORY_EVENTS=[
 {id:'law-pride',day:5,start:16,end:19,place:'law',icon:'⚖️',title:'Law Pride Week · opening afternoon',text:'Join a mock debate, hear student stories, and meet people outside your department.',choices:[{id:'debate',label:'Join the friendly debate',cost:0,effect:{knowledge:5,social:10,mood:6}},{id:'support',label:'Support the showcase & buy a souvenir',cost:400,effect:{social:10,mood:12}}]},
 {id:'engineering',day:12,start:14,end:18,place:'engineering',icon:'⚙️',title:'Engineering makers afternoon',text:'A prototype table, a stubborn circuit, and a team that could use another pair of hands.',choices:[{id:'build',label:'Help a team test its prototype',cost:0,effect:{skills:8,social:8,mood:5}},{id:'showcase',label:'Explore the demos & grab a snack',cost:300,effect:{knowledge:5,hunger:12,mood:10}}]},
 {id:'alfa-night',day:19,start:18,end:21,place:'alfa',icon:'🎶',title:'Alfa Belgore social night',text:'Music, an open mic, and familiar faces. Leave time to get home before the 22:00 curfew.',choices:[{id:'music',label:'Enjoy the music & meet people',cost:0,effect:{social:12,mood:12}},{id:'snacks',label:'Share snacks with your group',cost:600,effect:{social:12,hunger:18,mood:12}}]},
 {id:'src',day:24,start:14,end:18,place:'senate',icon:'🗳️',title:'SRC forum & election',text:'Two fictional candidates present their priorities. Cast one simulated vote; results arrive on day 25.',choices:[{id:'study',label:'Vote for Ada · study spaces & student projects',cost:0,effect:{social:5,knowledge:3}},{id:'wellbeing',label:'Vote for Femi · wellbeing & affordable activities',cost:0,effect:{social:5,mood:5}}]}
];
const STORY_CONVERSATIONS=[
 [
  {prompt:'Tomi’s latest app demo broke just before a presentation.',listen:'Listen, then offer to test the next build.',reply:'“Thank you for hearing me out. Let’s test one thing at a time.”',work:'Help break the bug into smaller steps.',effect:{skills:6}},
  {prompt:'Tomi is choosing between a paid gig and a personal project.',listen:'Ask what matters most this week.',reply:'“I needed someone to ask that, instead of choosing for me.”',work:'Work through a realistic time budget together.',effect:{skills:4,knowledge:2}},
  {prompt:'Tomi has a rough sketch for a new campus tool.',listen:'Ask to hear the idea before offering advice.',reply:'“You remembered what I was trying to build. That means a lot.”',work:'Sketch a small first version together.',effect:{skills:6}}
 ],
 [
  {prompt:'Dami is disappointed after a difficult practice test.',listen:'Listen without comparing scores.',reply:'“I feel better. We can try again without making this a competition.”',work:'Review one confusing topic together.',effect:{knowledge:6}},
  {prompt:'Dami wants to help everyone but is falling behind.',listen:'Encourage a manageable boundary.',reply:'“I can care about people and still protect my study time.”',work:'Make a short revision plan together.',effect:{knowledge:5,skills:1}},
  {prompt:'Dami wants to start a small study group.',listen:'Ask how to make quieter students feel welcome.',reply:'“Let’s make it somewhere people can ask questions freely.”',work:'Prepare a short group exercise.',effect:{knowledge:6}}
 ],
 [
  {prompt:'Zara is organising a hangout, but everyone has a different budget.',listen:'Suggest that nobody should feel pressured to spend.',reply:'“Exactly. Good company matters more than an expensive plan.”',work:'Help plan a free activity.',effect:{skills:4,social:3}},
  {prompt:'Zara is tired of always being the organiser.',listen:'Ask what support would actually help.',reply:'“Could you take one small task? I don’t need you to do everything.”',work:'Help organise the next event checklist.',effect:{skills:6}},
  {prompt:'Zara has been invited to two events on the same evening.',listen:'Talk through what she actually wants to attend.',reply:'“One good evening is enough. I don’t have to be everywhere.”',work:'Compare the timetable and transport options.',effect:{knowledge:3,skills:3}}
 ]
];
function ensureCampusStories(){
 const s=ensureStudentState();if(!s)return null;
 if(!s.stories)s.stories={bonds:people.map((_,i)=>({trust:Math.min(50,(state.friends[i]||0)*10),memories:[],dates:0})),partner:null,plan:null,events:{},votes:{}};
 return s.stories;
}
function storyKeyFor(id){return ensureJourney().semester+':'+id}
function storyMemory(i,text){const b=ensureCampusStories().bonds[i];b.memories.unshift({term:ensureJourney().semester,day:state.day,text});b.memories=b.memories.slice(0,8)}
function settleStoryPlans(){
 const s=ensureCampusStories(),p=s.plan;if(!p)return;
 if(p.term!==ensureJourney().semester||p.day<state.day||(p.day===state.day&&state.hour>19)||state.finished){
  s.plan=null;s.bonds[p.person].trust=clamp(s.bonds[p.person].trust-8);state.mood=clamp(state.mood-4);
  const text='Missed your plan with '+people[p.person].name+'. −8 trust, −4 mood. An honest conversation can rebuild the connection.';
  storyMemory(p.person,text);notifyStudent(text);log(text);
 }
}
function storyConversation(i){
 if(!Number.isInteger(i)||!people[i]||state.finished)return;
 const b=ensureCampusStories().bonds[i],scene=STORY_CONVERSATIONS[i][(state.day+ensureJourney().semester+i)%3];
 show(`<div class="eyebrow">A CONVERSATION WITH ${people[i].name.toUpperCase()}</div><h2>${people[i].icon} A little time together.</h2><p>${escapeHtml(scene.prompt)}</p><p class="phone-note">Trust ${b.trust}/100 · one conversation per character per day.</p>${phoneButton(scene.listen+' · 1 hr','data-story-talk="listen"',!!state.daily['friend'+i])}${phoneButton(scene.work+' · 1 hr','data-story-talk="work"',!!state.daily['friend'+i])}${phoneButton('Be honest: I only have a moment today · 15 min','data-story-talk="boundary"',!!state.daily['friend'+i])}<button class="text-button" id="storyConversationBack">Back to my people</button>`);
 document.querySelectorAll('[data-story-talk]').forEach(node=>node.onclick=()=>chooseStoryConversation(i,node.dataset.storyTalk));$('#storyConversationBack').onclick=()=>openStudentPhone('people');
}
function chooseStoryConversation(i,choice){
 if(!Number.isInteger(i)||!people[i]||!['listen','work','boundary'].includes(choice)||state.finished||state.daily['friend'+i])return;
 const short=choice==='boundary';if(!studentSpendTime(short?.25:1,short?-1:-5))return;
 const b=ensureCampusStories().bonds[i],scene=STORY_CONVERSATIONS[i][(state.day+ensureJourney().semester+i)%3];
 state.daily['friend'+i]=true;state.friends[i]=Math.min(5,state.friends[i]+(short?0:1));b.trust=clamp(b.trust+(short?3:choice==='listen'?9:7));
 effect({social:short?3:9,mood:short?2:6});if(choice==='work')effect(scene.effect);
 const reply=short?'“Thanks for telling me. We can catch up another time.”':choice==='listen'?scene.reply:'“Working through that together helped. Thank you.”';
 storyMemory(i,reply);studentCommit(people[i].name+': '+reply,'people');
}
friend=function(i){storyConversation(i)};
function askStoryPartner(i){
 const s=ensureCampusStories();if(!Number.isInteger(i)||!people[i]||state.finished||s.partner!==null||state.daily['askPartner'+i])return;
 if(!studentSpendTime(.25,-1))return;state.daily['askPartner'+i]=true;
 if(s.bonds[i].trust<40||state.friends[i]<3){storyMemory(i,'“I would rather keep getting to know each other as friends for now.”');studentCommit(people[i].name+' would like to stay friends for now. Build trust through conversations.','people');return}
 s.partner=i;storyMemory(i,'You both agreed to start dating.');studentCommit('You and '+people[i].name+' agreed to start dating. You can keep spending time together without spending money.','people');
}
function planStoryDate(i,budget){
 const s=ensureCampusStories(),plans={free:{cost:0,label:'A free courtyard catch-up'},split:{cost:300,label:'Split a small café treat'},treat:{cost:600,label:'Treat both of you to snacks'}};
 if(state.finished||s.partner!==i||!people[i]||!plans[budget])return;
 if(s.plan){toast('You already have a plan. Keep or cancel it first.');return}
 if(state.day>=28){toast('Plan your next date when the new semester begins.');return}
 if(state.daily.dateInvite){toast('One date invitation per game day.');return}
 s.plan={person:i,term:ensureJourney().semester,day:state.day+1,budget,...plans[budget]};state.daily.dateInvite=true;
 storyMemory(i,'Agreed to meet tomorrow at 18:00 near Caf 1.');studentCommit('Date planned for day '+s.plan.day+' at 18:00 near Caf 1. '+money(s.plan.cost)+' is charged only when you attend.','people');
}
function cancelStoryDate(){
 const s=ensureCampusStories();if(state.finished||!s.plan)return;
 const i=s.plan.person;s.plan=null;storyMemory(i,'You gave notice and cancelled the plan. No trust penalty.');studentCommit('Cancelled your plan with '+people[i].name+' respectfully. No money charged.','people');
}
function attendStoryDate(){
 settleStoryPlans();const s=ensureCampusStories(),p=s.plan;if(state.finished||!p)return;
 if(p.term!==ensureJourney().semester||p.day!==state.day||state.hour<18||state.hour>19){toast('Meet near Caf 1 on day '+p.day+', between 18:00 and 19:00.');return}
 if(state.location!=='cafe'){toast('Travel to Caf 1 to meet your date.');return}
 if(!studentSpendTime(1,-4,p.cost))return;
 s.plan=null;s.bonds[p.person].dates++;s.bonds[p.person].trust=clamp(s.bonds[p.person].trust+10);effect({mood:14,social:12});
 storyMemory(p.person,p.label+'. You kept your promise and enjoyed the time together.');
 studentCommit('You kept your date with '+people[p.person].name+'. +10 trust. '+(p.cost?money(p.cost)+' spent.':'A good evening, with no spending.'),'people');
}
function endStoryRelationship(){
 const s=ensureCampusStories();if(state.finished||s.partner===null)return;const i=s.partner;
 show(`<div class="eyebrow">AN HONEST CONVERSATION</div><h2>Return to friendship?</h2><p>You will end your relationship with ${people[i].name} and cancel any date. Friendship stays; trust falls by 5 and mood by 3.</p><button class="primary" id="confirmStoryBreakup">End the relationship respectfully</button><button class="secondary" id="cancelStoryBreakup">Stay together</button>`);
 $('#cancelStoryBreakup').onclick=()=>openStudentPhone('people');$('#confirmStoryBreakup').onclick=()=>{if(state.finished||s.partner!==i)return;s.partner=null;s.plan=null;s.bonds[i].trust=clamp(s.bonds[i].trust-5);state.mood=clamp(state.mood-3);state.daily['askPartner'+i]=true;storyMemory(i,'You agreed to return to friendship.');studentCommit('You and '+people[i].name+' ended the relationship respectfully.','people')};
}
function storyEventStatus(event){
 if(ensureCampusStories().events[storyKeyFor(event.id)])return 'Attended ✓';
 if(state.finished||state.day>event.day||(state.day===event.day&&state.hour>event.end-1))return 'Event closed';
 if(state.day===event.day&&state.hour>=event.start)return 'Open now';return 'Day '+event.day+' · '+formatGameTime(event.start)+'–'+formatGameTime(event.end);
}
function attendStoryEvent(id,choice,companion=-1){
 const s=ensureCampusStories(),event=CAMPUS_STORY_EVENTS.find(e=>e.id===id),option=event?.choices.find(c=>c.id===choice);
 if(state.finished||!event||!option||s.events[storyKeyFor(id)])return;
 if(state.day!==event.day||state.hour<event.start||state.hour+1>event.end){toast('This event runs on day '+event.day+', '+formatGameTime(event.start)+'–'+formatGameTime(event.end)+'.');return}
 if(state.location!==event.place){toast('Travel to '+places.find(p=>p.id===event.place).name+' first.');return}
 if(!Number.isInteger(companion)||companion< -1||companion>=people.length||(companion>=0&&state.friends[companion]<2)){toast('Invite a friend at friendship level 2 or above.');return}
 if(!studentSpendTime(1,-6,option.cost))return;
 s.events[storyKeyFor(id)]={choice,companion,day:state.day};effect(option.effect);ensureStudentState().reputation+=3;
 if(companion>=0){s.bonds[companion].trust=clamp(s.bonds[companion].trust+5);state.friends[companion]=Math.min(5,state.friends[companion]+1);storyMemory(companion,'Went to '+event.title+' together.')}
 if(id==='src')s.votes[ensureJourney().semester]=choice;
 if(!state.visits.includes(event.place))state.visits.push(event.place);
 studentCommit(event.title+': '+option.label+(companion>=0?' with '+people[companion].name:'')+'.','events');
}
function storyElectionResult(){
 if(state.day<25)return '';
 const vote=ensureCampusStories().votes[ensureJourney().semester],ada=50+(vote==='study'?1:0),femi=50+(vote==='wellbeing'?1:0);
 return `<div class="phone-banner"><b>SRC simulation · results</b><p>Ada: ${ada} votes · Femi: ${femi} votes.<br>${ada===femi?'A tie: both candidates agree to a joint student forum.':(ada>femi?'Ada’s study-space':'Femi’s wellbeing')+' platform wins this fictional election.'}</p><small>${vote?'Your saved vote is included.':'You did not cast a vote this semester.'} This is a scripted solo-game outcome, not a real student election.</small></div>`;
}
function storyPeopleContent(){
 const s=ensureCampusStories(),p=s.plan;
 return `<div class="story-intro"><span>♡</span><div><b>Good company. Your own pace.</b><p>Friendship is a complete path. Dating is optional; all story characters are fictional adults.</p></div></div>${p?`<div class="story-plan"><span class="eyebrow">A PROMISE TO KEEP</span><h3>${people[p.person].name} · day ${p.day}, 18:00</h3><p>${escapeHtml(p.label)} near Caf 1. ${money(p.cost)} on arrival · 1 hour. Arrive by 19:00. Cancelling ahead has no penalty; missing it costs 8 trust and 4 mood.</p>${phoneButton('Find Caf 1','data-go="cafe"')}${phoneButton('Attend our date','id="attendStoryDate"',state.finished||state.day!==p.day||state.hour<18||state.hour>19)}${phoneButton('Cancel with notice','id="cancelStoryDate"',state.finished)}</div>`:''}
 ${people.map((person,i)=>{const b=s.bonds[i],partner=s.partner===i;return `<article class="story-person"><div class="story-person-head"><span>${person.icon}</span><div><h3>${person.name}</h3><small>${person.role} · ${partner?'Dating':state.friends[i]>=3?'Close friend':'Getting acquainted'}</small></div></div><p>${escapeHtml(person.text)}</p><div class="story-meters"><span>Friendship <b>${state.friends[i]}/5</b></span><span>Trust <b>${b.trust}/100</b></span></div><div class="bar"><span style="width:${b.trust}%"></span></div>${phoneButton(state.daily['friend'+i]?'Caught up today ✓':'Talk with '+person.name,`data-story-person="${i}"`,state.finished||!!state.daily['friend'+i])}${partner?`<p class="phone-note">${b.dates} dates kept. Every date option gives the same trust reward.</p>${!p?['free','split','treat'].map((budget,n)=>phoneButton(['Plan a free catch-up tomorrow','Plan a shared treat · your share ₦300','Plan to treat both of you · ₦600'][n],`data-story-plan="${budget}" data-person="${i}"`,state.finished||state.day>=28||!!state.daily.dateInvite)).join(''):''}${phoneButton('Talk about ending the relationship','id="endStoryRelationship"',state.finished)}`:s.partner===null?`${phoneButton('Ask about dating · 15 min',`data-story-ask="${i}"`,state.finished||!!state.daily['askPartner'+i])}<small class="phone-note">A mutual yes needs friendship 3+ and trust 40+. No gift or purchase is required.</small>`:''}${b.memories.length?`<details><summary>Shared memories</summary>${b.memories.map(m=>`<p class="phone-note">Semester ${m.term}, day ${m.day} · ${escapeHtml(m.text)}</p>`).join('')}</details>`:''}</article>`}).join('')}`;
}
function storyEventsContent(){
 return `<p class="phone-note">Everyone can attend, regardless of department. These are fictional events on the game’s 28-day calendar. Each visit lasts 1 hour. Bring a friend from level 2; companion attendance adds 5 trust.</p>${storyElectionResult()}${CAMPUS_STORY_EVENTS.map(e=>`<article class="story-event"><div class="story-event-heading"><span>${e.icon}</span><small>DAY ${e.day} · ${formatGameTime(e.start)}–${formatGameTime(e.end)}</small></div><h3>${e.title}</h3><b class="story-event-status">${storyEventStatus(e)}</b><p>${e.text}</p><small>${escapeHtml(places.find(p=>p.id===e.place).name)}</small>${phoneButton('Find the venue',`data-go="${e.place}"`)}<label for="companion-${e.id}">Go with</label><select id="companion-${e.id}"><option value="-1">Just me</option>${people.map((p,i)=>`<option value="${i}" ${state.friends[i]<2?'disabled':''}>${p.name}${state.friends[i]<2?' · friendship 2 needed':''}</option>`).join('')}</select>${e.choices.map(c=>phoneButton(c.label+' · '+(c.cost?money(c.cost):'free'),`data-story-event="${e.id}" data-story-choice="${c.id}"`,state.finished||storyEventStatus(e)!=='Open now')).join('')}</article>`).join('')}`;
}
function storyFriendsOverview(){
 const s=ensureCampusStories();
 return `<div class="story-intro"><span>♡</span><div><b>Friendship, at your own pace.</b><p>Optional dating with fictional adult characters. Open My people to manage date plans and shared memories.</p>${phoneButton('Open My people','data-phone="people"')}</div></div>${people.map((p,i)=>`<article class="story-person"><div class="story-person-head"><span>${p.icon}</span><div><h3>${p.name}</h3><small>${p.role}</small></div></div><p>${escapeHtml(p.text)}</p><div class="story-meters"><span>Friendship <b>${state.friends[i]}/5</b></span><span>Trust <b>${s.bonds[i].trust}/100</b></span></div><p>${s.partner===i?'You are dating.':state.friends[i]>=3?'A close friend.':'A connection worth making time for.'}</p>${phoneButton(state.daily['friend'+i]?'Caught up today ✓':'Talk with '+p.name,`data-story-person="${i}"`,state.finished||!!state.daily['friend'+i])}${phoneButton('Plans & shared memories','data-phone="people"')}</article>`).join('')}`;
}
PHONE_APPS.splice(1,0,['people','♡','My people','Conversations, trust & optional dating.'],['events','🎟️','Campus events','Law Pride, makers, music & the SRC forum.']);
const storiesBasePhone=phoneAppContent;
phoneAppContent=function(app){return app==='people'?storyPeopleContent():app==='events'?storyEventsContent():storiesBasePhone(app)};
const storiesBaseBind=bindPhone;
bindPhone=function(app){
 storiesBaseBind(app);
 document.querySelectorAll('[data-story-person]').forEach(b=>b.onclick=()=>storyConversation(Number(b.dataset.storyPerson)));
 document.querySelectorAll('[data-story-ask]').forEach(b=>b.onclick=()=>askStoryPartner(Number(b.dataset.storyAsk)));
 document.querySelectorAll('[data-story-plan]').forEach(b=>b.onclick=()=>planStoryDate(Number(b.dataset.person),b.dataset.storyPlan));
 document.querySelectorAll('[data-story-event]').forEach(b=>b.onclick=()=>attendStoryEvent(b.dataset.storyEvent,b.dataset.storyChoice,Number($('#companion-'+b.dataset.storyEvent).value)));
 if(app==='people'){for(const [id,fn]of [['attendStoryDate',attendStoryDate],['cancelStoryDate',cancelStoryDate],['endStoryRelationship',endStoryRelationship]]){const b=$('#'+id);if(b)b.onclick=fn}}
};
const storiesBaseSync=syncStudentLife;
syncStudentLife=function(){storiesBaseSync();if(state)settleStoryPlans()};
const storiesBaseRender=render;
render=function(){
 storiesBaseRender();if(!state)return;
 if(tab==='friends'){$('#content').innerHTML=`<div class="story-page-heading"><div><span class="eyebrow">PEOPLE & STORIES</span><h2>Find your people.</h2><p>Small conversations, shared plans, and a campus full of invitations.</p></div><button class="secondary" id="storyOpenEvents">Browse campus events →</button></div><div class="story-friends-grid">${storyFriendsOverview()}</div>`;$('#storyOpenEvents').onclick=()=>openStudentPhone('events');bindPhone('people')}
 const event=CAMPUS_STORY_EVENTS.find(e=>storyEventStatus(e)==='Open now');
 if(event)$('#whisper').textContent=event.title+' is open until '+formatGameTime(event.end)+'. Find it in Campus events.';
 else if(ensureCampusStories().plan?.day===state.day)$('#whisper').textContent='You have a date planned at 18:00 near Caf 1. Check My people before heading out.';
};
if(state)render();
