import fetch from 'sync-fetch';
const url = 'http://127.0.0.1:3030';

function hash2array(hash) {
  const hasharray = [];
  for (let v of hash) {
      hasharray.push(v);
  }
  return hasharray;
}

function bigintArray2array(hash) {
  const hasharray = [];
  for (let v of hash) {
      hasharray.push(v.toString());
  }
  return hasharray;
}

function async_get_leaf(root, index) {
  let roothash = hash2array(root);
  const requestData = {
    jsonrpc: '2.0',
    method: 'get_leaf',
    params: {root: roothash, index: index.toString()},
    id: 1
  };
  //console.log("get leaf", root);
  const response = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = response.json();
    //console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to get leaf");
  }
}

export function get_leaf(root, index) {
  let data = async_get_leaf(root, index);
  return data;
}

function async_update_leaf(root, index, data) {
  let roothash = hash2array(root);
  let datahash = hash2array(data);
  const requestData = {
    jsonrpc: '2.0',
    method: 'update_leaf',
    params: {root: roothash, index: index.toString(), data: datahash},
    id: 2
  };

  //console.log("update leaf ...");
  const response = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = response.json();
    //console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to get leaf");
  }
}
export function update_leaf(root, index, data) {
  return async_update_leaf(root, index, data);
}

function async_update_record(hash, data) {
  let roothash = hash2array(hash);
  let datavec = bigintArray2array(data);
  const requestData = {
    jsonrpc: '2.0',
    method: 'update_record',
    params: {hash: roothash, data: datavec},
    id: 3
  };

  //console.log("update record ...");
  const response = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = response.json();
    //console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.log("update_record");
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to update_record");
  }
}

export function update_record(hash, data) {
  return async_update_record(hash, data);
}

function async_get_record(hash) {
  let hasharray = hash2array(hash);
  const requestData = {
    jsonrpc: '2.0',
    method: 'get_record',
    params: {hash: hasharray},
    id: 4
  };

  const response = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = response.json();
    let result = jsonResponse.result.map((x)=>{return BigInt(x)});
    return result;
  } else {
    console.log("get_record");
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to update_record");
  }
}

export function get_record(hash) {
  return async_get_record(hash);
}


