const fs = require('fs');
const path = require('path');
const glob = require('glob');

const srcDir = path.join(process.cwd(), 'src');
const files = glob.sync('**/*.{ts,tsx}', { cwd: srcDir, absolute: true });

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content
    .replace(/\/admin\/queue/g, '/admin/history')
    .replace(/\/api\/admin\/queue/g, '/api/admin/history');

  if (file.endsWith('AdminTopbar.tsx')) {
    newContent = newContent.replace('"/admin/history":            { title: "Queue" }', '"/admin/history":            { title: "History" }');
  }
  if (file.endsWith('AdminSidebar.tsx')) {
    newContent = newContent.replace('label: "Queue"', 'label: "History"');
  }

  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log('Updated ' + file);
  }
});
