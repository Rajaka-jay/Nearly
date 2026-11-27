/** Decorative seasons, not a live weather feed. Time follows the device clock. */
export const seasonNames=['spring','summer','autumn','winter'] as const;
export type Season=typeof seasonNames[number];
export function gardenMoment(date:Date){
 const hour=date.getHours();
 const phase=hour>=5&&hour<8?'sunrise':hour>=8&&hour<17?'day':hour>=17&&hour<19?'golden':hour>=19&&hour<21?'dusk':'night';
 const season:Season=seasonNames[Math.floor(((date.getMonth()+10)%12)/3)];
 return {phase,season,dark:phase==='dusk'||phase==='night'};
}
