// 操作记录：localStorage 环形日志，供 log.html 展示
const KEY = 'oplog', MAX = 500;
export function logOp(rec) {
  const arr = JSON.parse(localStorage[KEY] || '[]');
  arr.push({ t: Date.now(), ...rec });
  if (arr.length > MAX) arr.splice(0, arr.length - MAX);
  localStorage[KEY] = JSON.stringify(arr);
}
export const readOps = () => JSON.parse(localStorage[KEY] || '[]');
export const clearOps = () => { delete localStorage[KEY]; };
