const https = require('https');
const crypto = require('crypto');
const querystring = require('querystring');

// Define API credentials
const api_config = {
  "api_key": 'b3b4f15a-2650-4306-bfd6-df77542e7efb',
  "secret_key": 'FDE4A32353BA0A8BA6D03A28C25AC493',
  "passphrase": 'Vaibhav@2003',
};

function preHash(timestamp, method, request_path, params) {
  // Create a pre-signature based on strings and parameters
  let query_string = '';
  if (method === 'GET' && params) {
    query_string = '?' + querystring.stringify(params);
  }
  if (method === 'POST' && params) {
    query_string = JSON.stringify(params);
  }
  return timestamp + method + request_path + query_string;
}

function sign(message, secret_key) {
  // Use HMAC-SHA256 to sign the pre-signed string
  const hmac = crypto.createHmac('sha256', secret_key);
  hmac.update(message);
  return hmac.digest('base64');
}

function createSignature(method, request_path, params) {
  // Get the timestamp in ISO 8601 format
  const timestamp = new Date().toISOString().slice(0, -5) + 'Z';
  // Generate a signature
  const message = preHash(timestamp, method, request_path, params);
  const signature = sign(message, api_config['secret_key']);
  return { signature, timestamp };
}

function sendGetRequest(request_path, params) {
  // Generate a signature
  const { signature, timestamp } = createSignature("GET", request_path, params);

  // Generate the request header
  const headers = {
    'OK-ACCESS-KEY': api_config['api_key'],
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': api_config['passphrase'],
    'Content-Type': 'application/json'
  };

  const options = {
    hostname: 'web3.okx.com',
    path: request_path + (params ? `?${querystring.stringify(params)}` : ''),
    method: 'GET',
    headers: headers
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(data);
    });
  });

  req.end();
}

function sendPostRequest(request_path, params) {
  // Generate a signature
  const { signature, timestamp } = createSignature("POST", request_path, params);

  // Generate the request header
  const headers = {
    'OK-ACCESS-KEY': api_config['api_key'],
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': api_config['passphrase'],
    'Content-Type': 'application/json' 
  };

  const options = {
    hostname: 'web3.okx.com',
    path: request_path,
    method: 'POST',
    headers: headers
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(data);
    });
  });

  if (params) {
    req.write(JSON.stringify(params));
  }

  req.end();
}

// GET request example
const getRequestPath = '/api/v6/dex/aggregator/quote';
const getParams = {
  'chainIndex': 42161,
  'amount': 1000000000000,
  'toTokenAddress': '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
  'fromTokenAddress': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
};
sendGetRequest(getRequestPath, getParams);

// POST request example
const postRequestPath = '/api/v6/dex/index/current-price';
const postParams = [{
  chainIndex: "1",
  tokenContractAddress: "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72"
}];
sendPostRequest(postRequestPath, postParams); 