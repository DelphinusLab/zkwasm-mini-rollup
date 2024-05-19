import fetch from 'node-fetch';
const url = 'http://127.0.0.1:3030';

async function async_get_leaf(root, index) {
  const requestData = {
    jsonrpc: '2.0',
    method: 'get_leaf',
    params: [{root: root, index: index.toString()}],
    id: 123
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = await response.json();
    console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to get leaf");
  }
}

export function get_leaf(root, index) {
  async_get_leaf(root, index).then((value)=> value)
}

async function async_update_leaf(root, index, data) {
  const requestData = {
    jsonrpc: '2.0',
    method: 'update_leaf',
    params: [{root: root, index: index.toString(), data: data}],
    id: 123
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = await response.json();
    console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to get leaf");
  }
}
export function update_leaf(root, index, data) {
  async_update_leaf(root, index, data).then((value)=> value)
}

async function async_update_record(hash, data) {
  const requestData = {
    jsonrpc: '2.0',
    method: 'update_record',
    params: [{hash: hash, data: data}],
    id: 123
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = await response.json();
    console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to update_record");
  }
}

export function update_record(hash) {
  async_update_record(hash, data).then((value)=> value)
}

async function async_get_record(hash, data) {
  const requestData = {
    jsonrpc: '2.0',
    method: 'get_record',
    params: [{hash: hash, data: data}],
    id: 123
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });

  if (response.ok) {
    const jsonResponse = await response.json();
    console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to update_record");
  }
}

export function get_record(hash) {
  async_get_record(hash).then((value)=> value)
}


