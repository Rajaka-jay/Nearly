let authPending = false;
let recoveringPassword=location.hash.includes('type=recovery');
function authNotice(message, error=false) {
  const el=$('#auth-notice');
  if(el) {el.textContent=message;el.dataset.error=String(error);el.hidden=false;}
  else toast(message);
}
function authForm(mode='signin',email='') {
  if(!cloud)return;
  const signup=mode==='signup', recovery=mode==='recovery',reset=mode==='reset';
  const title=signup?'Make a little room for us.':recovery?'Let’s find your way back.':reset?'Choose a new password.':'A little closer starts here.';
  const caption=signup?'Create your own account, then invite your person.':recovery?'We’ll email you a link to choose a new password.':reset?'Use at least eight characters for your new password.':'Welcome back to your little world for two.';
  modal(`<div class="auth-brand">${uiIcon('sparkles')} nearly</div><h2>${title}</h2><p class="sub">${caption}</p><form id="auth-form">${reset?'':field('Email address','auth-email',email,'email')}${recovery?'':field(reset?'New password':'Password','auth-password','','password')}<p id="auth-notice" class="auth-notice" role="status" hidden></p><button class="btn auth-submit" type="submit">${signup?'Create account':recovery?'Send recovery link':reset?'Update password':'Sign in'} ${uiIcon('arrow-right')}</button></form>${!reset?`<div class="auth-links"><button class="link" id="switch-auth">${signup?'Already have an account? Sign in':'New here? Create an account'}</button>${!signup?'<button class="link" id="recover-auth">Forgot password?</button>':''}</div><button class="link" id="resend-confirm">Resend confirmation email</button>`:''}`);
  const password=$('#auth-password');if(password){password.minLength=8;password.autocomplete=signup||reset?'new-password':'current-password';}
  if($('#auth-email'))$('#auth-email').autocomplete='email';
  const redirect=location.origin+location.pathname;
  const setBusy=busy=>{authPending=busy;document.querySelectorAll('#auth-form button, .auth-links button, #resend-confirm').forEach(b=>b.disabled=busy)};
  $('#auth-form').onsubmit=async event=>{
    event.preventDefault();if(authPending)return;
    const email=$('#auth-email')?.value.trim(),password=$('#auth-password')?.value;
    setBusy(true);
    try {
      let response;
      if(reset)response=await cloud.auth.updateUser({password});
      else if(recovery)response=await cloud.auth.resetPasswordForEmail(email,{redirectTo:redirect});
      else if(signup)response=await cloud.auth.signUp({email,password,options:{emailRedirectTo:redirect}});
      else response=await cloud.auth.signInWithPassword({email,password});
      if(response.error)throw response.error;
      if(recovery)authNotice('Check your inbox for the recovery link.');
      else if(signup&&!response.data.session)authNotice('Check your inbox and confirm your email, then sign in here.');
      else {dialog.close();await enter();}
    }catch(error){authNotice(error.message,true)}finally{setBusy(false)}
  };
  if($('#switch-auth'))$('#switch-auth').onclick=()=>authForm(signup?'signin':'signup',$('#auth-email').value);
  if($('#recover-auth'))$('#recover-auth').onclick=()=>authForm('recovery',$('#auth-email').value);
  if($('#resend-confirm'))$('#resend-confirm').onclick=async()=>{
    const email=$('#auth-email');if(!email.reportValidity())return;setBusy(true);
    try{const {error}=await cloud.auth.resend({type:'signup',email:email.value.trim(),options:{emailRedirectTo:redirect}});if(error)throw error;authNotice('Confirmation requested. Please check your inbox.')}catch(error){authNotice(error.message,true)}finally{setBusy(false)}
  };
}
login=()=>authForm();
(async function initializeNearly(){
  state=structuredClone(defaults);navigate();
  document.querySelector('.demo').outerHTML='<button class="demo" onclick="spaceRecord?account():login()">Account & pairing</button>';
  if(!window.supabase || !window.NEARLY_CONFIG?.url || !window.NEARLY_CONFIG?.key){modal('<h2>We couldn’t connect yet.</h2><p class="sub">The sign-in service or project settings did not load. Check your connection and reload this page.</p><button class="btn" onclick="location.reload()">Try again</button>');return}
  cloud=window.supabase.createClient(NEARLY_CONFIG.url,NEARLY_CONFIG.key);
  cloud.auth.onAuthStateChange(event=>{
    if(event==='PASSWORD_RECOVERY'){recoveringPassword=true;setTimeout(()=>authForm('reset'),0);}
    if(event==='SIGNED_OUT'){clearInterval(syncTimer);spaceRecord=null;state=structuredClone(defaults);navigate();setTimeout(login,0)}
  });
  try{const {data,error}=await cloud.auth.getSession();if(error)throw error;if(recoveringPassword)authForm('reset');else if(data.session)await enter();else login()}catch(error){login();authNotice(error.message,true)}
})();
