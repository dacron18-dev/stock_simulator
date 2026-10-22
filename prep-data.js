// const fs = require('fs')
// const csv = require('csvtojson')
import fs from "fs";
import csv from "csvtojson";

// dd-mm-yyyy
const fetch_close = async (ticker, from, to) => {
  const requestOpts = {
    method: "GET",
    headers: {
      Cookie: process.env.NSE_COOKIE || "",
    },
  };
  const res = await fetch(
    `https://www.nseindia.com/api/historical/cm/equity?symbol=${ticker}&series=["EQ"]&from=${from}&to=${to}&csv=true`,
    requestOpts
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Failed to fetch data for ${ticker}. Status: ${res.status}. Text: ${text}`
    );
  }
  const data = await csv().fromString(text);
  // clear duplicates
  const uniqueData = [];

  for (const d of data) {
    if (!uniqueData.find((ud) => ud["Date "] === d["Date "])) {
      uniqueData.push(d);
    }
  }
  return uniqueData
    .map((d) => {
      return parseFloat(d["close "].replace(/,/g, ""));
    })
    .reverse();
};

const main = async () => {
  const tickers = [
    {
      name: "RELIANCE",
      from: "01-03-2020",
      to: "01-03-2021",
    },
    {
      name: "TCS",
      from: "01-01-2015",
      to: "01-01-2016",
    },
    {
      name: "RVNL",
      from: "01-03-2023",
      to: "01-03-2024",
    },
    {
      name: "IRCON",
      from: "01-01-2023",
      to: "01-01-2024",
    },
    {
      name: "VEDL",
      from: "01-04-2023",
      to: "01-04-2024",
    },
    {
      name: "PAYTM",
      from: "01-01-2022",
      to: "01-01-2023",
    },
    {
      name: "HAL",
      from: "01-01-2020",
      to: "01-01-2021",
    },
    {
      name: "BANKBARODA",
      from: "01-01-2021",
      to: "01-01-2022",
    },
    {
      name: "BAJAJ-AUTO",
      from: "01-01-2023",
      to: "01-01-2024",
    },
    {
      name: "TITAN",
      from: "01-01-2010",
      to: "01-01-2011",
    },
  ];

  const data = {};
  for (const ticker of tickers) {
    const close = await fetch_close(ticker.name, ticker.from, ticker.to);
    data[ticker.name] = close;
  }

  // now find minimum length
  let minLen = Infinity;
  let stock = "";
  for (const ticker in data) {
    minLen = Math.min(minLen, data[ticker].length);
    if (data[ticker].length === minLen) {
      stock = ticker;
    }
  }
  console.log("Stock with min length:", stock);
  console.log("Min length:", minLen);

  const aggregatedData = [];
  for (let i = 1; i < minLen; i++) {
    const row = [];
    for (const ticker in data) {
      row.push({
        ticker,
        close: data[ticker][i],
        change:
          ((data[ticker][i] - data[ticker][i - 1]) * 100) / data[ticker][i - 1],
      });
    }
    aggregatedData.push(row);
  }

  fs.writeFileSync("data.json", JSON.stringify(aggregatedData));
};

main();
