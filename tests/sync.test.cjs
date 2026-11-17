const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NearlySync:{merge}}=require('../sync-core.js');
test('simultaneous messages from separate devices survive',()=>{
 const base={messages:[{id:'old',text:'Hello'}]};
 const local={messages:[...base.messages,{id:'A',text:'Coffee?'}]};
 const remote={messages:[...base.messages,{id:'B',text:'Yes!'}]};
 assert.deepEqual(new Set(merge(base,local,remote).messages.map(m=>m.id)),new Set(['old','A','B']));
});
test('a local profile edit preserves a remote game move',()=>{
 const base={name:'Yasuru',rooms:{ttt:{board:['','',''],turn:'A'}}};
 const local=structuredClone(base);local.name='Y';
 const remote=structuredClone(base);remote.rooms.ttt.board[0]='X';remote.rooms.ttt.turn='B';
 const result=merge(base,local,remote);
 assert.equal(result.name,'Y');assert.equal(result.rooms.ttt.board[0],'X');assert.equal(result.rooms.ttt.turn,'B');
});
test('conflicting edits to the same contribution are explicitly rejected',()=>{
 assert.throws(()=>merge({title:'Before'},{title:'Local'},{title:'Remote'}),/Both of you changed title/);
});
test('deletion and unrelated additions both survive',()=>{
 const base=[{id:'one',text:'One'}];
 assert.deepEqual(merge(base,[],[...base,{id:'two',text:'Two'}]),[{id:'two',text:'Two'}]);
});
test('delete versus edit produces a conflict instead of dropping an edit',()=>{
 assert.throws(()=>merge([{id:'one',text:'Before'}],[],[{id:'one',text:'Edited'}]),/Both of you changed/);
});
