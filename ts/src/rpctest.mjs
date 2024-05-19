import fetch from 'node-fetch';
async function main() {
    const url = 'http://127.0.0.1:3030';
    const requestData = {
        jsonrpc: '2.0',
        method: 'get_leaf',
        params: [{ root: [
                    209, 25, 6, 57, 202, 38, 63, 205,
                    230, 191, 218, 42, 142, 209, 137, 151,
                    3, 59, 129, 218, 89, 249, 19, 143,
                    222, 94, 61, 88, 8, 55, 104, 39
                ], index: ((1n << 32n) + 2n).toString()
            }],
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
    }
    else {
        console.error('Failed to fetch:', response.statusText);
    }
}
main();
