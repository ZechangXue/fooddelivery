import {computePlan,computeRemaining} from '../public/route-core.mjs';
self.onmessage=e=>{try{const result=e.data.mode==='remaining'?computeRemaining(e.data):computePlan(e.data);self.postMessage({result});}catch(error){self.postMessage({error:error.message});}};
