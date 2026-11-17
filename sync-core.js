(function(root) {
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function merge(base, local, remote, path = '') {
    if (same(local, base)) return remote;
    if (same(remote, base) || same(local, remote)) return local;
    if (object(local) && object(remote) && (base === undefined || object(base))) {
      const out = {};
      for (const key of new Set([...Object.keys(base || {}),...Object.keys(local),...Object.keys(remote)])) {
        const value = merge(base?.[key],local[key],remote[key],path ? path+'.'+key : key);
        if (value !== undefined) out[key] = value;
      }
      return out;
    }
    const records = array => Array.isArray(array) && array.every(item => object(item) && typeof item.id === 'string');
    if (records(local) && records(remote) && (base === undefined || records(base))) {
      const baseMap = Object.fromEntries((base || []).map(x=>[x.id,x]));
      const localMap = Object.fromEntries(local.map(x=>[x.id,x]));
      const remoteMap = Object.fromEntries(remote.map(x=>[x.id,x]));
      return [...new Set([...remote.map(x=>x.id),...local.map(x=>x.id),...Object.keys(baseMap)])]
        .map(id=>merge(baseMap[id],localMap[id],remoteMap[id],path+'.'+id)).filter(x=>x!==undefined);
    }
    throw new Error('Both of you changed '+(path || 'this item')+'. Keep your draft and load the shared version before trying again.');
  }
  root.NearlySync = {merge};
})(typeof module !== 'undefined' ? module.exports : window);
