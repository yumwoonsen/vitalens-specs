// Pure projection for the accepted cards. UI renders this and emits intents only.
import * as Fx from "./EncounterFixtures"
import * as Sel from "./EncounterSelectors"
import {canDispatch,isVerified} from "./EncounterReducer"
import type {EncounterState,EncounterEvent} from "./EncounterTypes"

export interface CardAction {name:string;label:string;event:EncounterEvent;enabled:boolean}
export interface CardRow {label:string;value:string;kind?:"risk"|"body"}
export interface CardVital {label:string;display:string;unit:string}
export type CardSurface = "ward"|"privacy"|"identify"|"overview"|"care"|"note"|"cow"|"travel"|"bedside"|"brief"
export interface CardTab {name:string;label:string;event:EncounterEvent;selected:boolean}
export interface CardsView {
 visible:boolean;surface:CardSurface;title:string;subtitle:string;status:string;emergency:boolean;travel:boolean;
 rows:CardRow[];vitals:CardVital[];source:string;actions:CardAction[];presenter:CardAction[];
 tabs:CardTab[];menuOpen:boolean;patientKey:string;minimised:boolean;
 corner:"left"|"right";timer:string;contact:string
}
export function selectCards(s:EncounterState,seconds=0):CardsView {
 const emergency=s.phase === "emergency", pid=emergency?s.emergencyPatientId:s.scannedPatientId
 const patient=pid?Fx.PATIENTS[pid]:null
 const bed=emergency?"Bed 3":s.bedId?Fx.assignmentFor(s.bedId).bedLabel:""
 const v:CardsView={visible:s.session === "demo" && s.phase !== "boot" && s.phase !== "handover",surface:"ward",title:"Shift overview",subtitle:"Four assigned beds · fictional ward",status:"",emergency,travel:emergency&&!s.emergencyNear&&!s.emergencyBrief,rows:[],vitals:[],source:"Fictional data · simulated capabilities",actions:[],presenter:[],tabs:[],menuOpen:s.view.menuOpen,patientKey:pid??"",minimised:!emergency&&s.view.minimised,corner:s.view.miniCorner,timer:Sel.selectEmergency(s,seconds).drillTimer,contact:s.emergencyContact?"Call simulated":""}
 const action=(name:string,label:string,event:EncounterEvent,presenter=false)=>{(presenter?v.presenter:v.actions).push({name,label,event,enabled:canDispatch(s,event)})}
 action("BtnPresenterEmergency",emergency?"End drill":"Trigger Code Blue",{type:emergency?"CLOSE_EMERGENCY":"OPEN_EMERGENCY"},true)
 action("BtnPresenterReset","Reset demo",{type:"RESET"},true)
 if (emergency) {
  action("BtnPresenterWrongBand","Test wrong band",{type:"EMERGENCY_WRONG_BAND"},true)
  action("BtnPresenterCorner","Switch HUD side",{type:"SET_MINI_CORNER",corner:s.view.miniCorner === "right"?"left":"right"},true)
 }
 if (s.privacy) {
  v.surface="privacy";v.title="Patient information hidden";v.subtitle="Capture stopped. Nothing resumes automatically."
  action("BtnCardsPrivacyOff","Restore details",{type:"PRIVACY_OFF"});return v
 }
 if (s.phase !== "clockIn") action("BtnCardsPrivacy","Privacy",{type:"PRIVACY_ON"})
 if (emergency) {
  const e=Sel.selectEmergency(s,seconds);v.surface=s.emergencyBrief?"brief":v.travel?"travel":"bedside"
  v.title=patient?.fullName??"Unknown";v.subtitle="CODE BLUE · Bed 3 · 78 years · Full code"
  v.status=s.emergencyBand === "matched"?"Band matches":s.emergencyBand === "mismatch"?"Band mismatch · alert record unchanged":"Band not scanned"
  if(s.emergencyBrief){
   v.rows=[{label:"Situation",value:"Code Blue drill · Ward 7A · Bed 3. Mdm Tan Ah Lian, 78."},{label:"Background",value:"Right #NOF after fall · AF. Warfarin 3 mg ON. Penicillin anaphylaxis. Full code."},{label:"Available data",value:e.vitals.slice(0,3).map(x=>`${x.label} ${x.display} ${x.unit}`).join(" · ")},{label:"Request",value:"Emergency response to Bed 3; confirm team attendance. No treatment advice generated."}]
   action("BtnCloseBriefing","Close briefing",{type:"EMERGENCY_CLOSE_BRIEF"})
  }else{
   v.rows=[{label:"Warfarin",value:"3 mg ON",kind:"risk"},{label:"Penicillin allergy",value:"Anaphylaxis",kind:"risk"},{label:"Relevant context",value:"Right #NOF · AF · high fall risk"}]
   v.vitals=e.vitals.slice(0,3).map(x=>({label:x.label === "BP"?"BP · 09:00":x.label,display:x.display,unit:x.unit}))
   if(!v.travel)v.rows.push({label:"Temp",value:"Unknown"})
   action("BtnCallDoctor",s.emergencyContact?"Call simulated":"Simulate call",{type:"EMERGENCY_CONTACT"})
   action("BtnDoctorBriefing",v.travel?"Pause to read":"Doctor briefing",{type:"EMERGENCY_BRIEF"},v.travel)
   if(!v.travel)action("BtnEmergencyScan","Scan",{type:"EMERGENCY_SCAN"})
  }
  v.source="HR / SpO₂: sample playback, not live · BP: chart 09:00"
  return v
 }
 if(s.phase === "clockIn"){
  v.subtitle="No active patient. Select a bed to verify."
  const counts=Sel.selectWardFlags(s).counts
  v.rows=[{label:"Assigned / Obs / Meds / Fall risk",value:`${counts.assigned} / ${counts.obsDue} / ${counts.medsDue} / ${counts.fallRisk}`}]
  for(const b of Fx.WARD) {v.rows.push({label:b.bedLabel,value:b.needs.map(n=>n.label).join(" · ")});action("BtnBed"+b.bedId.slice(-1),b.bedLabel+" · "+Fx.PATIENTS[b.patientId].initials,{type:"SELECT_BED",bedId:b.bedId})}
  return v
 }
 if(!isVerified(s)){
  const id=Sel.selectIdentity(s);v.surface="identify";v.title="Wristband check";v.subtitle=bed+" · confirm name and date of birth"
  v.status=id.mismatchMessage??"Bed selection does not identify a patient."
  v.rows=id.rows.map(r=>({label:r.label,value:r.assignment+"\nBand: "+(r.wristband??"Not scanned")+(r.confirmed?" · confirmed":"")}))
  if(s.verification === "idle")action("BtnScanWristband","Scan wristband · simulated",{type:"SCAN_WRISTBAND",wristband:"assigned"})
  if(s.verification === "scanned") {action("BtnConfirmName","Name matches",{type:"CONFIRM_IDENTIFIER",identifier:"name"});action("BtnConfirmDob","DOB matches",{type:"CONFIRM_IDENTIFIER",identifier:"dob"})}
  if(s.verification === "mismatch")action("BtnRescan","Rescan",{type:"RESCAN"})
  action("BtnPresenterMismatch","Test wrong wristband",{type:"SCAN_WRISTBAND",wristband:"mismatchDemo"},true)
  action("BtnBackToBrief","Back to ward",{type:"BACK_TO_BRIEF"});return v
 }
 v.title=patient?.fullName??"Unknown";v.subtitle=`${bed} · ${patient?.age??"Unknown"} years · Verified · ${pid === "pt-bed2" || pid === "pt-target" ? "Full code" : "Code status: Unknown"}`
 v.surface=s.bodyView
 v.tabs=[{name:"BtnTabSummary",label:"Summary",event:{type:"OPEN_OVERVIEW"},selected:s.bodyView==="overview"},{name:"BtnTabCare",label:"Care",event:{type:"OPEN_CARE"},selected:s.bodyView==="care"},{name:"BtnTabNote",label:"Note",event:{type:"OPEN_NOTE"},selected:s.bodyView==="note"||s.bodyView==="cow"}]
 const routine=pid === "pt-bed2",record=pid?Fx.summaryFor(pid):[]
 if(s.bodyView === "overview"){
  v.rows=[{label:"Allergy",value:record.find(x=>x.card === "allergy")?.value??"Unknown"},{label:"Diagnosis",value:record.find(x=>x.card === "diagnosis")?.value??"Unknown"}]
  v.vitals=routine?Fx.ROUTINE_VITALS.map(x=>({...x})):[]
  v.rows.push({label:"Next pending",value:routine?"09:30 · Paracetamol":"Unknown"})
  v.source=routine?"Sample chart · 09:00 · NEWS is a fixed sample, not calculated":"Unknown facts remain Unknown"
  if(pid&&s.interruptedWork[pid])action("BtnReopenWork","Reopen unfinished note",{type:"REOPEN_WORK"})
  action("BtnOpenNote",s.note?"Continue note":"Start note",{type:"OPEN_NOTE"});action("BtnCarePlan","Care plan",{type:"OPEN_CARE"})
 }else if(s.bodyView === "care"){
  v.rows=record.filter(x=>x.card !== "vitals").map(x=>({label:x.label,value:x.details.join("\n")}))
  if(routine)v.rows.push({label:"Pending task",value:"Wound review · morning nurse"})
  action("BtnOverview","Patient overview",{type:"OPEN_OVERVIEW"})
 }else if(s.bodyView === "cow"){
  const d=s.downstream.find(x=>x.patientId === pid&&x.version === s.note?.version)
  v.rows=[{label:"Draft v"+(s.note?.version??"?"),value:Fx.LABELS.savedForReview},{label:"COW sign-off · simulated",value:d?"External sign-off simulated":"Awaiting review"},{label:"EHR receipt · simulated",value:d?.stage === "received"?"Receipt simulated. Nothing sent.":"No receipt yet"}]
  action("BtnCowSign","Simulate COW sign-off",{type:"COW_SIGN"},true);action("BtnEhrReceive","Simulate EHR receipt",{type:"EHR_RECEIVE"},true)
  action("BtnOverview","Patient overview",{type:"OPEN_OVERVIEW"});action("BtnOpenHandover","Handover",{type:"OPEN_HANDOVER"})
 }else{
  const draft=Sel.selectDraft(s),capture=Sel.selectCapture(s)
  if(s.note){
   v.status=draft.statusLabel??"";v.rows=[{label:"Transcript evidence",value:Fx.flagsFor(pid)[0]?.evidence??"Unknown"},{label:"Sample AI draft · v"+s.note.version,value:draft.lines.join("\n")}]
   if(s.note.status === "pendingReview"){action("BtnDownstream","View downstream status",{type:"OPEN_COW"});action("BtnAmend","Amend note",{type:"AMEND_NOTE"})}
   else if(s.note.status === "rejected")action("BtnNewCapture","New capture",{type:"NEW_CAPTURE"})
   else {
    if(!s.note.flags.every(f=>f.resolution !== null))action("BtnCorrectSite","Correct to right "+(routine?"knee":"hip"),{type:"OPEN_FLAG",flagId:"site"})
    if(s.view.openFlag)action("BtnPickRight","Confirm right "+(routine?"knee":"hip"),{type:"CORRECT_DRAFT",flagId:"site",optionId:"right"})
    action("BtnSaveForReview","Save for COW review",{type:"SAVE_FOR_REVIEW"});action("BtnReject","Reject",{type:"REJECT_DRAFT"})
   }
  }else{
   v.status=capture.statusMessage;v.rows=[{label:s.capture === "recording"?"Capture in progress":"Note",value:"Sample capture. No audio recorded. Consent and start remain deliberate."}]
   if(s.consent === "unasked"){action("BtnConsentGiven","Consent given",{type:"GRANT_CONSENT"});action("BtnConsentDeclined","Declined",{type:"DECLINE_CONSENT"})}
   else if(s.consent === "declined")action("BtnAskAgain","Ask again",{type:"RESET_CONSENT"})
   else action(s.capture === "recording"?"BtnStopCapture":"BtnStartCapture",s.capture === "recording"?"Stop note":"Start note",{type:s.capture === "recording"?"STOP_CAPTURE":"START_CAPTURE"})
  }
  action("BtnOverview","Patient overview",{type:"OPEN_OVERVIEW"})
 }
 return v
}
