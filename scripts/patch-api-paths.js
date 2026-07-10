const fs = require('fs');
const path = require('path');

function walk(dir) {
  return fs.readdirSync(dir).flatMap(f => {
    const p = path.join(dir, f);
    return fs.statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const root = path.join(__dirname, '..', 'apps', 'web', 'src');
const files = walk(root).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
let changed = 0;

const re = /(['"`])\/api\/v1(\/[^'"`]*)\1/gm;

files.forEach(f => {
  let s = fs.readFileSync(f, 'utf8');
  if (re.test(s)) {
    s = s.replace(re, (m, q, p1) => {
      return '`' + '${API_BASE}' + '/api/v1' + p1 + '`';
    });
    fs.writeFileSync(f, s);
    console.log('patched:', f);
    changed++;
  }
});
console.log('done', changed, 'files');
