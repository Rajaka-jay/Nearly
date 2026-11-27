/* Nearly activity covers: generated photographic assets hosted with the app. */
(function(global){
 'use strict';
 // Internal activities and online-game cards share this replaceable registry.
 const ids=['guess','roulette','match','ttt','rather','truths','letter','draw','focus','watch','cook','book','questions','playlist','chess','four','reversi','pebbles','basketball','golf','jigsaw','battleship'];
 const assets=Object.freeze(Object.fromEntries(ids.map(id=>[id,'assets/activities/'+id+'.webp'])));
 global.activityArt=function(id){
  const src=assets[id]||assets.questions;
  // The adjacent heading/button names the activity; the cover is decorative.
  return `<img class="activity-photo" src="${src}" width="800" height="480" alt="" aria-hidden="true" loading="lazy" decoding="async">`;
 };
 global.NearlyActivityArt={ids:Object.freeze(ids),assets};
})(window);
