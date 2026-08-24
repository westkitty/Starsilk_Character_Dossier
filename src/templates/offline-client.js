/* Root-page client for the narrow Starsilk offline shell. */
(function(){
  var status = document.getElementById('offlineStatus');
  var clearButton = document.getElementById('offlineCacheClear');
  var registration = null;

  function announce(message, state){
    if(!status) return;
    status.textContent = message;
    status.dataset.state = state || 'info';
  }

  if(!('serviceWorker' in navigator)){
    announce('Offline shell unavailable in this browser; live browsing remains available.', 'unavailable');
    if(clearButton) clearButton.disabled = true;
    return;
  }

  navigator.serviceWorker.addEventListener('message', function(event){
    var data = event.data || {};
    if(data.source !== 'starsilk-offline') return;
    if(data.type === 'offline-ready') announce('Offline shell ready: reading shell and public metadata are cached.', 'ready');
    if(data.type === 'offline-degraded') announce('Offline shell is partial; live browsing remains available.', 'degraded');
    if(data.type === 'offline-cache-cleared') announce('Offline cache cleared. Media was never stored here.', 'cleared');
    if(data.type === 'offline-cache-clear-failed') announce('Offline cache could not be cleared; live browsing remains available.', 'error');
  });

  navigator.serviceWorker.register('service-worker.js', {scope: './'}).then(function(value){
    registration = value;
    announce('Preparing offline shell and public metadata…', 'installing');
    return navigator.serviceWorker.ready;
  }).then(function(){
    if(status && status.dataset.state === 'installing') announce('Offline shell ready: reading shell and public metadata are cached.', 'ready');
  }).catch(function(){
    announce('Offline shell unavailable; live browsing remains available.', 'error');
    if(clearButton) clearButton.disabled = true;
  });

  if(clearButton){
    clearButton.addEventListener('click', function(){
      if(!registration){
        announce('Offline cache could not be cleared; live browsing remains available.', 'error');
        return;
      }
      announce('Clearing offline cache…', 'clearing');
      Promise.resolve(registration).then(function(value){
        var worker = value.active || value.waiting || value.installing;
        if(!worker) throw new Error('No active offline worker');
        worker.postMessage({type: 'CLEAR_STARSILK_OFFLINE_CACHE'});
      }).catch(function(){
        announce('Offline cache could not be cleared; live browsing remains available.', 'error');
      });
    });
  }
})();
