let cloud, spaceRecord, saving=false, pending=false, syncTimer;
const originalNavigate=navigate;
function cloudStatus(text){document.querySelector('.demo').textContent=text}
let confirmedData = structuredClone(defaults);
let savePromise = null;
let failedDraft = false;
function acceptSpace(s) {
  spaceRecord=s;
  confirmedData={...structuredClone(defaults),...(s?.data||{})};
  state=structuredClone(confirmedData);
  navigate();
  cloudStatus(s?.paired?'Connected for two':'Waiting for partner');
}
async function rpc(action,payload={}) {
  const {data,error}=await cloud.rpc('nearly_action',{action,payload});
  if(error)throw error;
  return data;
}
save=function() {
  if(!spaceRecord) {toast('Sign in and join your space before saving.');return false;}
  if(failedDraft) {toast('Resolve the unsaved draft before making another change.');return false;}
  pending=true;
  cloudStatus('Saving…');
  flush();
  return true;
};
async function flush() {
  if(savePromise)return savePromise;
  if(!pending)return;
  savePromise=(async()=>{
    saving=true;
    try {
      while(pending) {
        pending=false;
        const local=structuredClone(state);
        const base=structuredClone(confirmedData);
        let saved;
        for(let attempt=0;attempt<3;attempt++) {
          const latest=await rpc('get');
          if(!latest)throw Error('Your space is no longer available.');
          const remote={...structuredClone(defaults),...latest.data};
          const data=NearlySync.merge(base,local,remote);
          try {saved=await rpc('save',{revision:latest.revision,data});break;}
          catch(error) {if(!error.message.includes('CONFLICT')||attempt===2)throw error;}
        }
        const acknowledged={...structuredClone(defaults),...saved.data};
        // Merge edits made while the request was in flight into the confirmed state.
        state=NearlySync.merge(local,state,acknowledged);
        spaceRecord=saved;
        confirmedData=acknowledged;
        cloudStatus(pending?'Saving…':'Saved to your space');
      }
    } catch(error) {
      pending=false;
      failedDraft=true;
      cloudStatus('Unsaved changes');
      modal(`<h2>Keep your changes</h2><p class="sub" role="alert">${esc(error.message)}</p><p class="sub">Your edits are still in this view. Export a copy before loading the shared version.</p><button class="btn light" onclick="exportData()">Export my draft</button><button class="btn" id="reload-shared">Load shared version</button>`);
      $('#reload-shared').onclick=async()=>{try{const latest=await rpc('get');failedDraft=false;acceptSpace(latest);dialog.close()}catch(e){toast(e.message)}};
    } finally {saving=false;savePromise=null;}
  })();
  return savePromise;
}
function account(){modal(`<h2>Your shared space</h2><p class="sub">${spaceRecord.paired?'Your partner has joined.':'Send this one-use invitation code privately to your partner.'}</p>${spaceRecord.invite?`<input readonly aria-label="Invitation code" value="${esc(spaceRecord.invite)}">`:''}<p class="sub">Updates appear within a few seconds. Open the same activity on both devices to play together.</p><button class="btn light" id="logout">Sign out</button> <button class="link" id="leave">Leave space</button>${spaceRecord.owner&&!spaceRecord.paired?'<button class="link" id="invite">New invitation</button>':''}`);$('#logout').onclick=async()=>{await cloud.auth.signOut();location.reload()};if($('#invite'))$('#invite').onclick=async()=>{try{spaceRecord=await rpc('invite');account()}catch(e){toast(e.message)}};$('#leave').onclick=()=>{modal('<h2>Leave this space?</h2><p class="sub">You lose access to this space. Your partner keeps its shared content. If you are the only member, the space is deleted. Export your data first if needed.</p><button class="btn light" onclick="exportData()">Export data</button><button class="btn" id="leave-confirm">Leave space</button>');$('#leave-confirm').onclick=async()=>{try{await rpc('leave');location.reload()}catch(e){toast(e.message)}}}}
resetData=account;
about=account;
async function enter(){try{let s=await rpc('get');if(!s){modal('<h2>A little world for two</h2><button class="btn" id="create-space">Create our space</button><form id="join-space"><label for="code">Invitation code from your partner</label><input id="code" required name="code"><button class="btn light">Join their space</button></form>');$('#create-space').onclick=async()=>{try{acceptSpace(await rpc('create'));account();poll()}catch(e){toast(e.message)}};$('#join-space').onsubmit=async e=>{e.preventDefault();try{acceptSpace(await rpc('join',{code:new FormData(e.target).get('code').trim()}));dialog.close();poll()}catch(e){toast(e.message)}};return}acceptSpace(s);dialog.close();poll()}catch(e){toast(e.message)}}
function poll(){clearInterval(syncTimer);syncTimer=setInterval(async()=>{if(saving||pending||failedDraft||dialog.open)return;try{let s=await rpc('get');if(!s){location.reload();return}if(s.revision!==spaceRecord.revision||s.paired!==spaceRecord.paired)acceptSpace(s)}catch{cloudStatus('Connection interrupted')}},3000)}
function login(){form('Welcome to Nearly',field('Email','email','','email')+field('Password (at least 8 characters)','password','','password')+'<p class="sub">Use your own account. Your partner signs in with theirs.</p><button type="button" class="link" id="signup">Create an account</button>',async f=>{let {error}=await cloud.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)toast(error.message);else enter()},'Sign in');$('#password').minLength=8;$('#signup').onclick=async()=>{let f=$('#modal-form');if(!f.reportValidity())return;let {error}=await cloud.auth.signUp({email:$('#email').value,password:$('#password').value});toast(error?error.message:'Check your email to confirm your account, then sign in here.')};dialog.oncancel=e=>e.preventDefault()}
