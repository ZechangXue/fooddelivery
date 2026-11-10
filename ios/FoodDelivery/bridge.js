(() => {
  if (location.origin !== 'https://wembley-walk-delivery.superxin24.chatgpt.site') return;
  const send = body => window.webkit.messageHandlers.deliveryNative.postMessage(body);
  const watches = new Map(), copies = new Map(); let next = 1;
  const stopIfIdle = () => { if (!watches.size) send({action:'stopLocation'}); };
  function subscribe(success, error, options = {}, once = false) {
    const id = next++; const entry = {success,error,once,timer:null}; watches.set(id,entry);
    if (Number.isFinite(options.timeout) && options.timeout >= 0) entry.timer = setTimeout(() => {
      if (!watches.has(id)) return;
      error?.({code:3,message:'定位超时',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3});
      if(once){watches.delete(id);stopIfIdle();}
    }, options.timeout);
    send({action:'startLocation'}); return id;
  }
  const geo = {
    getCurrentPosition:(success,error,options)=>{subscribe(success,error,options,true);},
    watchPosition:(success,error,options)=>subscribe(success,error,options,false),
    clearWatch:id=>{const item=watches.get(id);if(item)clearTimeout(item.timer);watches.delete(id);stopIfIdle();}
  };
  Object.defineProperty(navigator,'geolocation',{value:geo,configurable:true});
  const writeText = text => new Promise((resolve,reject)=>{
    const id=next++;const timer=setTimeout(()=>{copies.delete(id);reject(new Error('复制超时'));},5000);
    copies.set(id,{resolve,reject,timer});send({action:'copy',text:String(text),id});
  });
  try { Object.defineProperty(navigator,'clipboard',{value:{writeText},configurable:true}); } catch {}
  window.__deliveryNativeReceive = payload => {
    if(payload.type==='copied'){const item=copies.get(payload.id);if(item){clearTimeout(item.timer);copies.delete(payload.id);item.resolve();}return;}
    for(const [id,item] of [...watches]){
      clearTimeout(item.timer);
      if(payload.type==='position'){
        item.success({coords:payload.coords,timestamp:payload.timestamp});
        if(item.once)watches.delete(id);
      }else if(payload.type==='locationError'){
        item.error?.({code:payload.code,message:payload.message});
        if(item.once||payload.code===1)watches.delete(id);
      }
    }
    stopIfIdle();
  };
})();
