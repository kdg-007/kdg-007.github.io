// Replace the old QA shell worker without deleting caches, databases or drafts.
if('serviceWorker' in navigator&&location.protocol==='https:'){
 navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
}
