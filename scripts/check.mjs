import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
for(const file of readdirSync('.').filter(file=>file.endsWith('.js')))execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log('JavaScript syntax checks passed.');
