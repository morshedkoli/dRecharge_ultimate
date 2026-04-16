const fs = require('fs');

const replaces = [
  {
    file: 'src/app/(dashboard)/admin/balance-requests/page.tsx',
    search: /useEffect\(\(\) => \{\s*const unsub = onSnapshot[^;]+;\s*return \(\) => unsub\(\);\s*\}, \[\]\);/s,
    replace: `useEffect(() => {
    let mounted = true;
    fetch("/api/admin/balance-requests")
      .then(r => r.json())
      .then(d => { if (mounted && d.requests) setRequests(d.requests); })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);`
  },
  {
    file: 'src/app/(dashboard)/admin/categories/page.tsx',
    search: /useEffect\(\(\) => \{\s*const unsub = onSnapshot[^;]+;\s*return \(\) => unsub\(\);\s*\}, \[\]\);/s,
    replace: `useEffect(() => {
    let mounted = true;
    fetch("/api/admin/categories")
      .then(r => r.json())
      .then(d => { if (mounted && d.categories) setCategories(d.categories); })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);`
  },
  {
    file: 'src/app/(dashboard)/admin/services/page.tsx',
    search: /useEffect\(\(\) => \{\s*const unsubCat = onSnapshot[\s\S]+?return \(\) => \{\s*unsubCat\(\);\s*unsubSvc\(\);\s*\};\s*\}, \[\]\);/s,
    replace: `useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/admin/categories").then(r => r.json()),
      fetch("/api/admin/services").then(r => r.json())
    ]).then(([catData, svcData]) => {
      if (!mounted) return;
      if (catData.categories) setCategories(catData.categories);
      if (svcData.services) setServices(svcData.services);
    }).catch(console.error);
    return () => { mounted = false; };
  }, []);`
  },
  {
    file: 'src/app/(dashboard)/admin/queue/[jobId]/page.tsx',
    search: /useEffect\(\(\) => \{\s*const unsubJob = onSnapshot[\s\S]+?return \(\) => \{\s*unsubJob\(\);\s*if \(unsubTx\) unsubTx\(\);\s*\};\s*\}, \[params\.jobId\]\);/s,
    replace: `useEffect(() => {
    let mounted = true;
    fetch(\`/api/admin/queue/\${params.jobId}\`)
      .then(r => r.json())
      .then(d => {
        if (!mounted) return;
        if (d.job) setJob(d.job);
        if (d.transaction) setTransaction(d.transaction);
      }).catch(console.error);
    return () => { mounted = false; };
  }, [params.jobId]);`
  },
  {
    file: 'src/app/(dashboard)/admin/services/[serviceId]/page.tsx',
    search: /useEffect\(\(\) => \{\s*const q = query\(collection\(db, "transactions"\)[\s\S]+?return \(\) => unsub\(\);\s*\}, \[params\.serviceId\]\);/s,
    replace: `useEffect(() => {
    let mounted = true;
    fetch(\`/api/admin/services/\${params.serviceId}/transactions\`)
      .then(r => r.json())
      .then(d => { if (mounted && d.transactions) setTransactions(d.transactions); })
      .catch(console.error);
    return () => { mounted = false; };
  }, [params.serviceId]);`
  }
];

replaces.forEach(({ file, search, replace }) => {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (file.includes('admin\\\\users')) {
       // fallback for windows path separators
    }
  }
  
  if (content && search.test(content)) {
    content = content.replace(search, replace);
    fs.writeFileSync(file, content);
    console.log("Fixed " + file);
  } else {
    // If exact regex fails, check if the file still has onSnapshot and replace the whole block more aggressively
    if (content && content.includes('onSnapshot')) {
      const effectStart = content.indexOf('useEffect(() => {');
      const effectEnd = content.indexOf('}, [', effectStart) + content.substring(content.indexOf('}, [', effectStart)).indexOf(');') + 2;
      
      if (effectStart !== -1 && effectEnd !== -1) {
         content = content.substring(0, effectStart) + replace + content.substring(effectEnd);
         fs.writeFileSync(file, content);
         console.log("Aggressively fixed " + file);
      } else {
         console.log("FAILED to fix " + file);
      }
    } else {
      console.log("No onSnapshot found in " + file + " (already fixed?)");
    }
  }
});
