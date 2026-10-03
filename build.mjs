import { access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
for (const file of ['index.html','style.css','app.js','codec.js','receiver.js']) {
  await access('dist/' + file);
  if (file.endsWith('.js')) execFileSync(process.execPath,['--check','dist/' + file],{stdio:'inherit'});
}
console.log('Static application verified: dist/');
