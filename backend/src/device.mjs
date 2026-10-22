export const DEVICE_TYPES=['mobile','desktop','tablet','unknown'];
export const validDeviceFilter=value=>['all',...DEVICE_TYPES].includes(value);
export function requestDevice(request){
 const hint=request.headers.get('X-SF-Device');if(DEVICE_TYPES.includes(hint)&&hint!=='unknown')return hint;
 const ua=request.headers.get('User-Agent')||'';
 if(/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i.test(ua))return 'tablet';
 if(/iPhone|iPod|Android.*Mobile|Windows Phone|Mobi/i.test(ua))return 'mobile';
 if(/Windows NT|Macintosh|Mac OS X|X11|CrOS|Linux/i.test(ua))return 'desktop';
 return 'unknown';
}
