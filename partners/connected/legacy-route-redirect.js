// Legacy KeepIt launch links used '/?connected-app=…'. Preserve them while
// routing only explicit app selections to the maintained LiveIt-first shell.
// A bare '/' still opens the unchanged KeepIt library. No storage or OAuth writes.
(()=>{
 'use strict';
 if(location.pathname!=='/')return;
 const params=new URLSearchParams(location.search);
 const choices=params.getAll('connected-app');
 if(choices.length!==1 || !['liveit','keepit','thinkit','travelit'].includes(choices[0]))return;
 const destination=new URL('/partners/connected/',location.origin);
 destination.search=location.search;
 destination.hash=location.hash;
 location.replace(destination.pathname+destination.search+destination.hash);
})();
