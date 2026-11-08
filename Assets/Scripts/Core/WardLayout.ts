// Shared centimetre geometry. Bed positions use the mattress-centre datum.
export const WARD_LAYOUT = {
  beds: {bed1:[0,65,-260], bed2:[-240,65,-260], bed3:[0,65,0], bed4:[240,65,0]},
  board:[62,77,79], wrist:[-10,12.3,40], destination:[0,75,0], approach:[0,95,165],
  // Bed 2 is the hero bay (HeroBay2.glb): Mr Hakim wears the band on his RIGHT wrist, the aisle side (+X with his head
  // at -Z). Measured 7 Nov 2026 from the "Hero wristband" mesh against Bed 2's anchor (-204, -95, -165): the band centre
  // is (+27.7, +18.3, -21.4) from it. The other beds keep `wrist` until their models are rebuilt. See wristOffset.
  wristHero:[27.7,18.3,-21.4],
  // Marker tips float clearly above the patient, pointing down. bedPinTip is from the bed centre: over
  // the upper body, 45 cm above the pillow's top at y = 20. scanTip is from the wrist anchor: 15 cm up,
  // so the scan pointer sits just over the hand and wristband rather than floating above the bed.
  bedPinTip:[0,65,-50], scanTip:[0,15,0],
  // Measured from VitalLensWard.glb, the same on all four beds: the head end is -Z from the bed
  // centre and the aisle runs along x = aisleX. See dashboardPose.
  // sideSign is the one place to flip a row: the X direction from the bed to its dashboard, seen
  // walking in from the entrance (facing -Z, so right is +X). +1 is the viewer's right, -1 their left.
  // The panel's near edge sits gapCm from the bed's side edge on that side; panelHalfWidthCm is half
  // of PANEL_W in VitaLensScreenUI at UI_SCALE. The nurse stands standBackCm out from the aisle-side
  // edge, level with the wrist, so a panel beside the head does not block the patient.
  // panelY is the panel centre's height: the nurse's torso, 40 cm below the eye at y = 0.
  dashboard:{head:[0,23,-72], aisleX:0, bedHalfWidthCm:55, gapCm:20, panelHalfWidthCm:16, standBackCm:60, eyeY:0, panelY:-40,
    sideSign:{leftRow:1, rightRow:-1}},
  // Bed flags, the same on all four beds and attached to the bed: offset is the flag centre from the
  // bed centre, over the head end (-Z). Clear of the dashboard beside the head (its near edge is
  // bedHalfWidthCm + gapCm out), the curtain tracks at y ~ 122 and the WARD 7A sign on the far wall.
  // y 82: with the realism patients (backrest 20°) the hair top is at y 58.5 from the bed centre, so the
  // flag's bottom edge (82 - 15 = 67) clears it by 8.5 cm (WARD27). size and textEmCm in cm.
  flag:{offset:[0,82,-80], size:[56,30], textEmCm:4},
  enterCm:140, exitCm:170, depthCm:110,
  surfaces:{board:[32,38],travel:[24,20],routine:[22,5],status:[12,5]},
} as const

/** Where the wristband is, from the bed's anchor: the hero model's right wrist on Bed 2, the legacy anchor elsewhere. */
export function wristOffset(bedId:string|null):readonly [number,number,number] {
 return bedId === "bed2" ? WARD_LAYOUT.wristHero : WARD_LAYOUT.wrist
}
export interface DashboardPose {
  readonly position:readonly [number,number,number]
  /** Where the nurse stands: on the aisle side, level with the wrist. */
  readonly stand:readonly [number,number,number]
  /** Radians about +Y, so the panel's front faces the standing point. */
  readonly yaw:number
}
/**
 * The bed's world-locked dashboard: level with the patient's head, at torso height, beside the bed on
 * the side given by sideSign for the bed's row, facing the standing point. The row comes from the
 * bed's position relative to the aisle centreline, never its number.
 */
export function dashboardPose(bed:readonly [number,number,number]):DashboardPose {
  const d=WARD_LAYOUT.dashboard
  const leftRow=bed[0]<d.aisleX
  const sign=leftRow?d.sideSign.leftRow:d.sideSign.rightRow
  const towardsAisle=leftRow?1:-1
  const headZ=bed[2]+d.head[2]
  const stand=[bed[0]+towardsAisle*(d.bedHalfWidthCm+d.standBackCm),d.eyeY,bed[2]+WARD_LAYOUT.wrist[2]] as const
  const edgeX=bed[0]+sign*d.bedHalfWidthCm
  // The panel turns to face the nurse, which narrows it in X, so solve its centre once from the turn.
  const yawAt=(x:number)=>Math.atan2(stand[0]-x,stand[2]-headZ)
  const yaw=yawAt(edgeX+sign*(d.gapCm+d.panelHalfWidthCm))
  const x=edgeX+sign*(d.gapCm+d.panelHalfWidthCm*Math.abs(Math.cos(yaw)))
  return {position:[x,d.panelY,headZ],stand,yaw:yawAt(x)}
}
export function followAlpha(dt:number,rate=8):number {return 1-Math.exp(-Math.max(0,dt)*rate)}
export function proximityEvent(near:boolean,distance:number):"enter"|"exit"|null {
  return !near && distance<WARD_LAYOUT.enterCm ? "enter" : near && distance>WARD_LAYOUT.exitCm ? "exit" : null
}
// Keep the complete surface within the 53 x 77 cm binocular plane, inset 2 cm.
export function hudOffset(width:number,height:number,side:"left"|"right") {
  return {x:(side === "right"?1:-1)*(53/2-2-width/2),y:Math.min(height<=5?30:14,77/2-2-height/2)}
}

export const PREVIEW_ORIGIN=[0,-160,-165] as const
export function previewBed(id:keyof typeof WARD_LAYOUT.beds){
 const p=WARD_LAYOUT.beds[id];return [p[0],p[1]+PREVIEW_ORIGIN[1],p[2]+PREVIEW_ORIGIN[2]] as const
}
