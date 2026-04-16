const fs = require('fs');
const path = require('path');
const globSync = require('child_process').execSync('dir /b /s *.tsx *.ts', { encoding: 'utf8' }).split('\r\n').filter(Boolean);

function processFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Remove Firebase imports
  const lines = content.split('\n');
  const newLines = lines.filter(line => {
    if (line.includes('firebase/firestore') || line.includes('firebase/auth') || line.includes('firebase/client')) {
      return false;
    }
    return true;
  });

  if (newLines.length !== lines.length) {
    content = newLines.join('\n');
    changed = true;
  }

  // AdminSidebar / UserSidebar logout fixes
  if (file.includes('AdminSidebar.tsx') || file.includes('UserSidebar.tsx')) {
    if (content.includes('await signOut(auth)')) {
      content = content.replace('await signOut(auth);', '');
      changed = true;
    }
    if (content.includes('await auth.signOut()')) {
      content = content.replace('await auth.signOut();', '');
      changed = true;
    }
  }

  // Fix implicit any TS errors
  if (file.endsWith('page.tsx')) {
    if (content.includes('(t) =>')) {
      content = content.replace(/\(t\) =>/g, '(t: any) =>');
      changed = true;
    }
    if (content.includes('(s, d) =>')) {
      content = content.replace(/\(s, d\) =>/g, '(s: any, d: any) =>');
      changed = true;
    }
    if (content.includes('(t, v) =>')) {
      content = content.replace(/\(t, v\) =>/g, '(t: any, v: any) =>');
      changed = true;
    }
    if (content.includes('Promise<string | number>')) {
      content = content.replace(/Promise<string \| number>/g, 'Promise<void>');
      changed = true;
    }
  }

  // Agent services route _auth path fix
  if (file.endsWith('route.ts') && content.includes('../../../_auth')) {
    content = content.replace('../../../_auth', '../../_auth');
    changed = true;
  }
  
  // admin users route sort issue fix
  if (file.replace(/\\/g, '/').includes('admin/users/route.ts')) {
    if (content.includes('.sort({ createdAt: -1 })')) {
      content = content.replace('.sort({ createdAt: -1 })', '.sort({ createdAt: -1 } as any)');
      changed = true;
    }
  }

  // DeviceStatusDot revoked missing
  if (file.endsWith('DeviceStatusDot.tsx')) {
    if (!content.includes('revoked: {')) {
      content = content.replace(/offline:\s*\{\s*color:\s*"[^"]+",\s*animate:\s*[^,]+,\s*label:\s*"Offline"\s*\},?/, 'offline: { color: \"bg-on-surface-variant\", animate: false, label: \"Offline\" },\n  revoked: { color: \"bg-red-500\", animate: false, label: \"Revoked\" },');
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Fixed ' + file);
  }
}

globSync.forEach(f => {
  if (f.includes('node_modules') || f.includes('.next')) return;
  processFile(f);
});
