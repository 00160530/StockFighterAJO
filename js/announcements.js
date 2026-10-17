(function(root){
'use strict';
function valid(a){return !!a&&typeof a.title==='string'&&a.title.length>0&&a.title.length<=120&&typeof a.body==='string'&&a.body.length>0&&a.body.length<=4000&&Number.isSafeInteger(a.publishedAt)&&a.publishedAt>0;}
function unseen(a,last){return valid(a)&&a.publishedAt>(Number.isSafeInteger(last)?last:0);}
root.TaiguAnnouncements={valid,unseen};
})(globalThis);
