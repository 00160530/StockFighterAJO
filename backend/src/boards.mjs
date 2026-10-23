export {CATEGORIES,category,scoreReceipt} from './top100.mjs';
import {topSnapshot} from './top100.mjs';
export async function boardSnapshot(env,playerId=null,before=null,options={}){
 if(before)throw Error('Before-upload state is captured transactionally at write time.');
 return topSnapshot(env,playerId,options);
}
