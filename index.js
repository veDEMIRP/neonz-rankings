// Calculate rarity scores and ranks for NEONZ using TZKT on Tezos Blockchain
//
// Created by PRIME Dev & Kevin Elliott
//
// Github: https://github.com/veDEMIRP/neonz-rankings
// Twitter: https://twitter.com/DosEsposas
// Twitter: https://twitter.com/kevinelliott

import { bytes2Char } from '@taquito/utils';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// SETTINGS

//const IPFS_BASE_URL = 'http://localhost:8081';
const TZKT_BASE_URL = 'https://api.tzkt.io/v1';
const NEONZ_TOKEN_CONTRACT = 'KT1MsdyBSAMQwzvDH4jt2mxUKJvBSWZuPoRJ';
const NEONZ_TZKT_URL = `${TZKT_BASE_URL}/contracts/${NEONZ_TOKEN_CONTRACT}/bigmaps/token_metadata/keys?active=true&select=value&limit=10000`;
const COLLECTION_TOTAL = 10000;
const IPFS_BASE_URL = 'https://cloudflare-ipfs.com/ipfs';
const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs',
  'https://ipfs.io/ipfs',
  'https://ipfs.fleek.co/ipfs',
  'https://ipfs.infura.io/ipfs',
];
const IPFS_RANDOM_GATEWAY = true;
const IPFS_PARALLEL_REQUESTS = 4;
const DEBUG = true;

// INITIALIZATIONS

let tokens = {};
let attributeNames = [];
let attributeValues = {};
let attributeCounts = {};
let attributeRarityScores = {};
let attributeRarityPercentages = {};
let tokensSortedById = [];
let tokensSortedByRank = [];

// FUNCTIONS

async function getNEONZIPFSList() {
  console.log('Getting token info for all NEONZ from TZKT');
  const response = await axios.get(NEONZ_TZKT_URL);
  const tokens = response.data;
  console.log(`Discovered ${tokens.length} NEONZ`);

  const list = [];
  for (const token of tokens) {
    const tokenId = token.token_id;
    const ipfsUri = bytes2Char(token.token_info['']);
    list.push({ tokenId: tokenId, ipfsUri: ipfsUri });
  }

  return list;
}

async function getTokenMetadataFromIPFS(ipfsUri) {
  let ipfsBaseUrl = IPFS_BASE_URL;
  if (IPFS_RANDOM_GATEWAY) {
    ipfsBaseUrl = getRandomIPFSGateway();
  }
  const ipfsUrl = ipfsUri.replace('ipfs://', ipfsBaseUrl + '/');
  const data = await axios.get(ipfsUrl)
    .then(function ({data}) {
      return data;
    })
    .catch(function (error) {
      console.log(`Error: ${ipfsUrl} ${error.message}`);
    });
  return data;
}

async function cacheData(data, filename) {
  const cachePath = 'ipfs_cache';
  fs.existsSync(cachePath) || fs.mkdirSync(cachePath);
  if (fs.existsSync(filename)) {
    console.log(`Skipping. Cached token metadata exists already at ${filename}`);
  } else {
    const json = JSON.stringify(data);
    fs.writeFileSync(filename, json);
  }
}

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function loadCacheOrGetTokenMetadataFromIPFS(item) {
  const filename = `ipfs_cache/neonz_${item.tokenId}.json`;
  let tokenMetadata;

  if (fs.existsSync(filename)) {
    tokenMetadata = JSON.parse(fs.readFileSync(filename));
    console.log(`Loading token metadata from cache for Token ID ${item.tokenId}`);
    if (tokenMetadata.attributes.length == 1 && tokenMetadata.attributes[0].name == 'status' && tokenMetadata.attributes[0].value == 'hidden') {
      console.log(`Cache contains stale data from pre-hatch for Token ID ${item.tokenId}.`);
      console.log(tokenMetadata.attributes);
      fs.unlinkSync(filename);
      await sleep(1000);
      console.log(`Refetching token metadata from IPFS for Token ID ${item.tokenId}`);
      tokenMetadata = await getTokenMetadataFromIPFS(item.ipfsUri);
      console.log(tokenMetadata.attributes);
      await cacheData(tokenMetadata, filename);
    }
  } else {
    console.log(`Retrieving token metadata from IPFS for Token ID ${item.tokenId}`);
    tokenMetadata = await getTokenMetadataFromIPFS(item.ipfsUri);
    await cacheData(tokenMetadata, filename);
  }
  return tokenMetadata;
}

function incrementAttribute(attribute) {
  if (attributeNames.indexOf(`${attribute.name}`) < 0) {
    attributeNames.push(`${attribute.name}`);
  }

  if (!!!attributeValues[`${attribute.name}`]) {
    attributeValues[`${attribute.name}`] = [];
  }

  if (attributeValues[`${attribute.name}`].indexOf(`${attribute.value}`) < 0) {
    attributeValues[`${attribute.name}`].push(`${attribute.value}`);
  }


  if (!!!attributeCounts[`${attribute.name}`]) {
    attributeCounts[`${attribute.name}`] = {};
  }
  if (!!!attributeCounts[`${attribute.name}`][`${attribute.value}`]) {
    attributeCounts[`${attribute.name}`][`${attribute.value}`] = 0;
  }
  attributeCounts[`${attribute.name}`][`${attribute.value}`] = attributeCounts[`${attribute.name}`][`${attribute.value}`] + 1;
}

function calculateAttributeRarityScores(totals) {
  for (const name of attributeNames) {
    for (const value of attributeValues[`${name}`]) {
      const itemsWithTraitCount = attributeCounts[`${name}`][`${value}`];
      attributeRarityScores[`${name} - ${value}`] = 1 / (itemsWithTraitCount / COLLECTION_TOTAL);
    }
  }
}

function calculateAttributeRarityPercentages(totals) {
  for (const name of attributeNames) {
    for (const value of attributeValues[`${name}`]) {
      const itemsWithTraitCount = attributeCounts[`${name}`][`${value}`];
      attributeRarityPercentages[`${name} - ${value}`] = itemsWithTraitCount / COLLECTION_TOTAL;
    }
  }
}

function calculateTokenRarityScores() {
  tokens = Object.values(tokens).map((token) => {
    let rarityScore = 0;
    for (const attr of token.attributes) {
      rarityScore += attributeRarityScores[`${attr.name} - ${attr.value}`];
    }
    token.rarityScore = rarityScore;
    return token;
  });
}

function sortTokensById() {
  tokensSortedById = Object.keys(tokens).map((key) => {
    const token = tokens[key];
    return token;
  });
  tokensSortedById = tokensSortedById.sort((a, b) => a.id - b.id);
}

function sortTokensByRank() {
  tokensSortedByRank = Object.keys(tokens).map((key) => {
    const token = tokens[key];
    return token;
  });
  tokensSortedByRank = tokensSortedByRank.sort((a, b) => b.rarityScore - a.rarityScore);
}

function exportTokenRanksToCsv() {
  const filename = 'neonz-by-rank.csv';
  const csvLines = ['rank,id,score'];
  for (const [i, token] of tokensSortedByRank.entries()) {
    csvLines.push(`${i+1},${String(token.id).padStart(4, '0')},${token.rarityScore}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n'));
}

function exportTokensToCsv() {
  const filename = 'neonz-by-id.csv';
  const csvLines = ['id,rank,score'];
  for (const [i, token] of tokensSortedByRank.entries()) {
    csvLines.push(`${String(token.id).padStart(4, '0')},${i+1},${token.rarityScore}`);
  }
  fs.writeFileSync(filename, csvLines.join('\n'));
}

function exportTokensToJSON() {
  const filename = 'neonz.json';
  const tokensById = {};
  for (const [i, token] of tokensSortedByRank.entries()) {
    token.rank = i + 1;
    tokensById[token.id] = token;
  }
  fs.writeFileSync(filename, JSON.stringify(tokensById));
}

async function runner(items, fn) {
  while (items.length > 0)
    await fn(items.shift()) ;
}

async function eachLimit(items, fn, limit) {
  await Promise.all([...Array(limit)].map(() => runner(items, fn)));
}

function getRandomIPFSGateway() {
  const random = Math.floor(Math.random() * IPFS_GATEWAYS.length);
  return IPFS_GATEWAYS[random];
}

// MAIN

const ipfsList = await getNEONZIPFSList();
const items = [];
let ids = ipfsList.map(i => parseInt(i.tokenId));
ids = ids.sort((a, b) => a - b);

eachLimit(ids, async function(id) {
  const item = ipfsList.find(i => i.tokenId == id);
  const tokenMetadata = await loadCacheOrGetTokenMetadataFromIPFS(item);
}, IPFS_PARALLEL_REQUESTS);

for (const id of ids) {
  const item = ipfsList.find(i => i.tokenId == id);
  const tokenMetadata = await loadCacheOrGetTokenMetadataFromIPFS(item);
  tokenMetadata.attributes.push({ name: 'Attributes', value: tokenMetadata.attributes.length })
  // console.log(tokenMetadata);
  const attributes = [];
  for (const attr of tokenMetadata.attributes) {
    const attribute = {
      name: attr.name,
      value: attr.value
    };
    attributes.push(attribute);
    incrementAttribute(attribute);
  }
  const rankingDetail = {
    id: item.tokenId,
    rank: 0,
    score: 0,
    name: tokenMetadata.name,
    displayUri: tokenMetadata.displayUri,
    attributes: attributes
  };
  tokens[`${item.tokenId}`] = rankingDetail;
}

// CALCULATIONS
calculateAttributeRarityScores();
calculateAttributeRarityPercentages();
calculateTokenRarityScores();
sortTokensById();
sortTokensByRank();

// SUMMARY DEBUG OUTPUT

if (DEBUG) {
  console.log('');
  console.log('Attribute Counts');
  console.log(JSON.stringify(attributeCounts));
  console.log('');
  console.log('Attribute Rarity Scores');
  console.log(JSON.stringify(attributeRarityScores));
  console.log('');
  console.log('Attribute Rarity Percentages');
  console.log(JSON.stringify(attributeRarityPercentages));
  console.log('Tokens (By rarity scores)');
  console.log(JSON.stringify(tokens));
  console.log('Token (By rank)');
  console.log(JSON.stringify(tokensSortedByRank));
}

exportTokensToCsv();
exportTokenRanksToCsv();
exportTokensToJSON();
