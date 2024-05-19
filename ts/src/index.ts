import fetch from 'node-fetch';
const url = 'http://127.0.0.1:3030';

async function async_get_leaf(root: Array<number>, index:bigint) {
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
    const jsonResponse:any = await response.json();
    console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to get leaf");
  }
}

function get_leaf(root: Array<number>, index: bigint) {
  async_get_leaf(root, index).then((value: any)=> value)
}

async function async_update_leaf(root: Array<number>, index:bigint, data: Array<number>) {
  const requestData = {
    jsonrpc: '2.0',
    method: 'get_leaf',
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
    const jsonResponse:any = await response.json();
    console.log(jsonResponse);
    return jsonResponse.result;
  } else {
    console.error('Failed to fetch:', response.statusText);
    throw("Failed to get leaf");
  }
}

function update_leaf(root: Array<number>, index: bigint, data: Array<number>) {
  async_update_leaf(root, index, data).then((value: any)=> value)
}


