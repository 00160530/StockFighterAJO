import {topSnapshot,personalize} from './top100.mjs';
import {EDITION} from './edition.mjs';
import {readProfile} from './profile.mjs';
import {publicData} from './public-cache.mjs';
export async function publicBoards(request,env,playerId=null,scope={}){
 const snapshot=await publicData(request,env,'top100:'+EDITION.id+':'+(scope.mode||'all')+':'+(scope.board||'all'),()=>topSnapshot(env,null,{...scope,owners:true}));
 const profile=playerId?await readProfile(env,playerId):null;
 return {boards:personalize(snapshot.data,playerId,profile),generatedAt:Math.floor(snapshot.createdAt/1000),cache:snapshot.status};
}
