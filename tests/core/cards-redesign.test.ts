import {test} from "node:test"
import assert from "node:assert/strict"
import {createInitialState,reduce} from "../../Assets/Scripts/Core/EncounterReducer"
import {selectCards} from "../../Assets/Scripts/Core/CardPresentation"
import {selectCapture,selectDraft,selectHandover} from "../../Assets/Scripts/Core/EncounterSelectors"
import {run,VERIFY,CORRECT_RIGHT,assertNoOp} from "./helpers"
import type {EncounterState,BedId} from "../../Assets/Scripts/Core/EncounterTypes"

function verified(bed:BedId="bed2",from=createInitialState()):EncounterState {
 return run([{type:"START_DEMO"},{type:"CLOCK_IN"},{type:"SELECT_BED",bedId:bed},...VERIFY],from)
}
function draft(from=verified()):EncounterState {
 return run([{type:"OPEN_NOTE"},{type:"GRANT_CONSENT"},{type:"START_CAPTURE"},{type:"STOP_CAPTURE"}],from)
}
function saved(from=verified()):EncounterState{return run([...CORRECT_RIGHT,{type:"SAVE_FOR_REVIEW"}],draft(from))}

test("six short metric labels retain values, units, chart time and sample NEWS",()=>{
 const v=selectCards(verified())
 assert.deepEqual(v.vitals.map(x=>x.label),["HR","SpO₂","BP","Temp","RR","NEWS"])
 assert.deepEqual(v.vitals.map(x=>x.display),["78","97","124/76","36.8","16","0"])
 assert.deepEqual(v.vitals.map(x=>x.unit),["bpm","%","mmHg","°C","/min","sample"])
 assert.match(v.source,/09:00/)
})
test("routine transcript and note have knee content; emergency record is independent",()=>{
 const s=draft()
 assert.match(selectCapture(s).transcript?.lines.join(" ")??"",/right knee/)
 assert.match(selectDraft(s).lines.join(" "),/left knee/)
 assert.doesNotMatch(JSON.stringify(selectDraft(s)),/hip|warfarin/i)
 const e=reduce(s,{type:"OPEN_EMERGENCY"})
 assert.equal(e.emergencyPatientId,"pt-target")
 assert.match(JSON.stringify(selectCards(e)),/Warfarin/)
 assert.equal(e.emergencyBand,"none")
 assert.equal(e.bedId,null)
})
test("wrong band changes warning, never alert-linked record or routine verification",()=>{
 const e=run([{type:"OPEN_EMERGENCY"},{type:"EMERGENCY_WRONG_BAND"}],verified())
 assert.equal(e.emergencyPatientId,"pt-target");assert.equal(e.emergencyBand,"mismatch")
 assert.equal(e.verification,"idle");assert.equal(e.scannedPatientId,null)
 assertNoOp(e,{type:"START_CAPTURE"})
})
test("contact remains across travel, proximity and both HUD corners",()=>{
 const e=run([{type:"OPEN_EMERGENCY"},{type:"EMERGENCY_CONTACT"}],verified())
 const near=reduce(e,{type:"EMERGENCY_NEAR"})
 assert.equal(selectCards(near).travel,false)
 const far=run([{type:"EMERGENCY_AWAY"},{type:"SET_MINI_CORNER",corner:"left"}],near)
 assert.equal(selectCards(far).travel,true);assert.equal(far.emergencyContact,true)
 assert.equal(far.emergencyPatientId,e.emergencyPatientId)
 assert.equal(selectCards(far).corner,"left")
})
test("emergency preserves privacy and never invents a partial transcript",()=>{
 const recording=run([{type:"GRANT_CONSENT"},{type:"START_CAPTURE"},{type:"PRIVACY_ON"}],verified())
 const e=reduce(recording,{type:"OPEN_EMERGENCY"})
 assert.equal(e.privacy,true);assert.equal(selectCards(e).surface,"privacy")
 assert.equal(e.interruptedWork["pt-bed2"],undefined)
 const end=reduce(e,{type:"CLOSE_EMERGENCY"});assert.equal(end.privacy,true)
 assert.equal(end.note,null);assert.equal(end.transcript,"none")
})
test("archive is patient-specific, reverify does not reopen, explicit reopen restores no consent",()=>{
 const original=saved(),closed=run([{type:"OPEN_EMERGENCY"},{type:"CLOSE_EMERGENCY"}],original)
 assert.equal(closed.phase,"clockIn");assert.equal(closed.bedId,null)
 assert.deepEqual(closed.interruptedWork["pt-bed2"]?.note,original.note)
 const other=verified("bed4",closed);assertNoOp(other,{type:"REOPEN_WORK"})
 const back=verified("bed2",closed);assert.equal(back.note,null);assert.equal(back.consent,"unasked")
 const reopened=reduce(back,{type:"REOPEN_WORK"})
 assert.deepEqual(reopened.note,original.note);assert.equal(reopened.capture,"idle")
 assert.equal(reopened.consent,"unasked");assert.equal(reopened.interruptedWork["pt-bed2"],undefined)
 assert.deepEqual(reduce(reopened,{type:"RESET"}),createInitialState())
})
test("navigation cannot retain hidden capture or bypass emergency cleanup",()=>{
 const rec=run([{type:"OPEN_NOTE"},{type:"GRANT_CONSENT"},{type:"START_CAPTURE"}],verified())
 assert.equal(reduce(rec,{type:"OPEN_OVERVIEW"}).capture,"interrupted")
 const e=reduce(saved(),{type:"NAV_NEXT"});assert.equal(e.phase,"emergency")
 const end=reduce(e,{type:"NAV_BACK"});assert.equal(end.phase,"clockIn");assert.equal(end.note,null)
})
test("seeded wrong-side selection is refused; correction and deliberate save required",()=>{
 const s=reduce(draft(),{type:"OPEN_FLAG",flagId:"site"})
 assertNoOp(s,{type:"CORRECT_DRAFT",flagId:"site",optionId:"left"})
 assertNoOp(s,{type:"SAVE_FOR_REVIEW"})
 assert.equal(run([...CORRECT_RIGHT,{type:"SAVE_FOR_REVIEW"}],s).note?.status,"pendingReview")
})
test("unsaved COW access cannot imply saved or signed state",()=>{
 assertNoOp(verified(),{type:"OPEN_COW"});assertNoOp(draft(),{type:"OPEN_COW"})
 assertNoOp(draft(),{type:"COW_SIGN"})
 const s=saved();const c=run([{type:"OPEN_COW"},{type:"COW_SIGN"},{type:"EHR_RECEIVE"}],s)
 assert.equal(c.note?.status,"pendingReview");assert.equal(c.downstream[0].version,2)
 assert.equal(c.downstream[0].patientId,"pt-bed2");assert.equal(c.downstream[0].stage,"received")
})
test("repeated encounters and archived amendments cannot inherit another note receipt",()=>{
 const old=run([{type:"COW_SIGN"},{type:"EHR_RECEIVE"},{type:"OPEN_EMERGENCY"},{type:"CLOSE_EMERGENCY"}],saved())
 const newer=saved(verified("bed2",old));assert.equal(newer.note?.version,4)
 const received=run([{type:"COW_SIGN"},{type:"EHR_RECEIVE"},{type:"TOGGLE_MENU"},{type:"REQUEST_SWITCH"},{type:"CONFIRM_PENDING"}],newer)
 const reopened=reduce(verified("bed2",received),{type:"REOPEN_WORK"});assert.equal(reopened.note?.version,2)
 const amend=run([{type:"AMEND_NOTE"},...CORRECT_RIGHT,{type:"SAVE_FOR_REVIEW"}],reopened)
 assert.equal(amend.note?.version,5)
 assert.equal(amend.downstream.some(x=>x.version===amend.note?.version),false)
})
test("retained handover has patient-specific provenance and Back does not start drill",()=>{
 const s=run([{type:"OPEN_HANDOVER"},{type:"BUILD_HANDOVER"},{type:"APPROVE_HANDOVER"}],saved())
 const text=JSON.stringify(selectHandover(s));assert.match(text,/right knee/);assert.doesNotMatch(text,/hip|warfarin|10:00/i)
 const back=reduce(s,{type:"NAV_BACK"});assert.equal(back.phase,"review");assert.equal(back.bodyView,"cow")
 assert.deepEqual(back.note,s.note)
})
test("unsupported patients retain Unknown code status and no fabricated chart time",()=>{
 const v=selectCards(verified("bed4"))
 assert.match(v.subtitle,/Unknown/);assert.doesNotMatch(v.subtitle,/Full code/)
 assert.doesNotMatch(v.source,/09:00/);assert.equal(v.vitals.length,0)
})
