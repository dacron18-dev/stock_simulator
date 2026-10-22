import fs from "fs";
import crypto from "crypto";
import { readFile } from "fs/promises";

// Read the original data
// const originalData = require("./data.json");
let originalData;
try {
  originalData = JSON.parse(
    await readFile(new URL("./data.json", import.meta.url))
  );
} catch (e) {
  console.error(e);
}

// Company aliases for obfuscation - using real company names
const companyAliases = {
  NVD: [
    "TITAN",
    "ZOMATO",
    "PAYTM",
    "HAL",
    "BAJAJ-AUTO",
    "BANKBARODA",
    "VEDL",
    "IRCON",
    "RVNL",
    "TCS",
  ],
  SNL: [
    "INFOSYS",
    "WIPRO",
    "HCL",
    "TECHM",
    "MINDTREE",
    "LTI",
    "MPHASIS",
    "PERSISTENT",
    "COFORGE",
    "LTTS",
  ],
  DKS: [
    "IRCON",
    "CONCOR",
    "CONTAINER",
    "RAILTEL",
    "RITES",
    "MRPL",
    "ONGC",
    "IOC",
    "BPCL",
    "HPCL",
  ],
  KLJ: [
    "RVNL",
    "CONCOR",
    "CONTAINER",
    "RAILTEL",
    "RITES",
    "MRPL",
    "ONGC",
    "IOC",
    "BPCL",
    "HPCL",
  ],
  BDK: [
    "HINDALCO",
    "JSPL",
    "SAIL",
    "TATASTEEL",
    "JINDALSTEL",
    "COALINDIA",
    "NMDC",
    "MOIL",
    "NLCINDIA",
    "CIL",
  ],
  DBR: [
    "ZOMATO",
    "SWIGGY",
    "NYKAA",
    "POLICYBAZAAR",
    "CARDEKHO",
    "MAKEMYTRIP",
    "YATRA",
    "CLEARTRIP",
    "IXIGO",
    "EASEMYTRIP",
  ],
  AHP: [
    "BEL",
    "BEML",
    "MIDHANI",
    "COCHINSHIP",
    "GARDENREACH",
    "MAZAGON",
    "HUDCO",
    "NBCC",
    "NBVENTURES",
    "NTPC",
  ],
  PTS: [
    "SBI",
    "HDFCBANK",
    "ICICIBANK",
    "KOTAKBANK",
    "AXISBANK",
    "INDUSINDBK",
    "FEDERALBNK",
    "BANDHANBNK",
    "RBLBANK",
    "IDFCFIRSTB",
  ],
  VKV: [
    "HEROMOTOCO",
    "TVSMOTORS",
    "EICHERMOT",
    "MOTHERSON",
    "BOSCHLTD",
    "EXIDEIND",
    "AMARAJABAT",
    "SUPRAJIT",
    "MUNJALSHOWA",
    "ENDURANCE",
  ],
  CRC: [
    "RELIANCE",
    "ZOMATO",
    "PAYTM",
    "HAL",
    "BAJAJ-AUTO",
    "BANKBARODA",
    "VEDL",
    "IRCON",
    "RVNL",
    "TCS",
  ],
};

// Generate random seed for consistent obfuscation
const seed =
  process.env.OBFUSCATION_SEED || crypto.randomBytes(16).toString("hex");
// console.log('Using obfuscation seed:', seed);

// Simple seeded random number generator
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return () => {
    hash = (hash * 9301 + 49297) % 233280;
    return Math.abs(hash / 233280); // Ensure positive values
  };
}

const random = seededRandom(seed);

// Generate random price multipliers (0.3x to 3.0x)
const priceMultipliers = {};
const priceOffsets = {};
const changeMultipliers = {};

// Original tickers from the data
const originalTickers = originalData[0].map((stock) => stock.ticker);

originalTickers.forEach((ticker) => {
  priceMultipliers[ticker] = Math.abs(0.5 + random() * 2.0); // 0.5 to 2.5 (ensure positive)
  priceOffsets[ticker] = 50 + random() * 200; // +50 to +250 (positive offset only)
  changeMultipliers[ticker] = 0.5 + random() * 1.5; // 0.5 to 2.0
});

// console.log('Price multipliers:', priceMultipliers);
// console.log('Price offsets:', priceOffsets);
// console.log('Change multipliers:', changeMultipliers);

// Create ticker mapping
const tickerMapping = {};
const usedAliases = new Set();

originalTickers.forEach((ticker) => {
  const availableAliases = companyAliases[ticker].filter(
    (alias) => !usedAliases.has(alias)
  );
  if (availableAliases.length === 0) {
    // If all aliases are used, create a random one
    const randomSuffix = Math.floor(random() * 1000);
    tickerMapping[ticker] = `${ticker}_${randomSuffix}`;
  } else {
    const selectedAlias =
      availableAliases[Math.floor(random() * availableAliases.length)];
    tickerMapping[ticker] = selectedAlias;
    usedAliases.add(selectedAlias);
  }
});

// console.log('Ticker mapping:', tickerMapping);

// Time period shuffling - randomly shift the data
const timeShift = Math.floor(random() * Math.min(50, originalData.length - 10));
// console.log('Time shift applied:', timeShift);

// Obfuscate the data
const obfuscatedData = [];

for (let i = 0; i < originalData.length; i++) {
  const originalRow = originalData[i];
  const obfuscatedRow = [];

  originalRow.forEach((stock) => {
    const originalTicker = stock.ticker;
    const newTicker = tickerMapping[originalTicker];

    // Apply price transformation
    const multiplier = priceMultipliers[originalTicker];
    const offset = priceOffsets[originalTicker];
    let newClose = stock.close * multiplier + offset;

    // Apply change transformation
    const changeMultiplier = changeMultipliers[originalTicker];
    let newChange = stock.change * changeMultiplier;

    // Add small random noise
    newClose += (random() - 0.5) * 0.1;
    newChange += (random() - 0.5) * 0.001;

    // Ensure stock price is never negative - set minimum to 1.00
    newClose = Math.max(newClose, 1.0);

    obfuscatedRow.push({
      ticker: newTicker,
      close: Math.round(newClose * 100) / 100, // Round to 2 decimal places
      change: Math.round(newChange * 10000) / 10000, // Round to 4 decimal places
    });
  });

  obfuscatedData.push(obfuscatedRow);
}

// Apply time shift
const shiftedData = [
  ...obfuscatedData.slice(timeShift),
  ...obfuscatedData.slice(0, timeShift),
];

// Data is already processed with noise and rounding
const noisyData = shiftedData;

// Create mapping file for reference (keep this secret!)
const mapping = {
  seed: seed,
  timeShift: timeShift,
  tickerMapping: tickerMapping,
  priceMultipliers: priceMultipliers,
  priceOffsets: priceOffsets,
  changeMultipliers: changeMultipliers,
  originalTickers: originalTickers,
  obfuscatedTickers: Object.values(tickerMapping),
  generatedAt: new Date().toISOString(),
};

// Write obfuscated data
fs.writeFileSync("competition-data.json", JSON.stringify(noisyData, null, 2));
fs.writeFileSync("mapping.json", JSON.stringify(mapping, null, 2));

// console.log('\n=== OBFUSCATION COMPLETE ===');
// console.log('Generated competition-data.json with obfuscated data');
// console.log('Generated mapping.json (KEEP THIS SECRET!)');
// console.log(`Data points: ${noisyData.length}`);
// console.log(`Tickers: ${Object.values(tickerMapping).join(', ')}`);
// console.log('\nTo use in production:');
// console.log('1. Copy competition-data.json to replace data.json');
// console.log('2. Or update app.js to load competition-data.json');
// console.log('3. Keep mapping.json secret - delete it after noting down if needed');
