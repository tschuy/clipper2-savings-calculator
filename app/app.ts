// interfaces defining structures for data pulled in from GTFS CSVs & XML API responses 
interface FareTransferRule {
  from_leg_group_id: string | null;
  to_leg_group_id: string | null;
  transfer_count: number | null;
  duration_limit: number | null;
  duration_limit_type: string | null;
  fare_transfer_type: string | null;
  fare_product_id: string | null;
  filter_fare_product_id: string | null;
}

interface FareProduct {
  fare_product_id: string;
  fare_product_name: string;
  amount: number;
  currency: string;
  duration_start: string | null;
  duration_amount: string | null;
  duration_unit: string | null;
  duration_type: string | null;
  rider_category_id: string | null;
  fare_media_id: string | null;
}

interface GTFSAgency {
  Id: string;
  Name: string;
  LastGenerated: string;
}

interface Stop {
  stop_id: string;
  stop_name: string;
}

/*
  Zone management

  Fares for zonal products are stored in fare_products with fare names using the scheme:
  * XX:matrix:XX:zoneId-XX:zoneId, for zonal fare products
  * BA:matrix:stationId-stationId, for BART fare products
  
  To match this, zones here are stored such that the key of the dict is the zoneId, and the
  value is the official human-readable name.  
*/
const ggtZones = {
  "San Francisco": "Zone 1: San Francisco",
  "Sausalito-Marin City-Mill Valley": "Zone 2: Sausalito, Marin City, Mill Valley, Tiburon",
  "CorteMadera-SanRafael-Marinwood": "Zone 3: Corte Madera, Larkspur, San Anselmo, San Rafael, Terra Linda, Lucas Valley, Marinwood",
  "Ignacio-Novato-San Marin": "Zone 4: Ignacio, Hamilton, Novato",
  "Petaluma-Cotati-Rohnert Park": "Zone 5: Petaluma, Cotati, Rohnert Park",
  "Santa Rosa": "Zone 6: Santa Rosa",
  "East Bay": "Zone 7: Richmond, El Cerrito"
};

const caltrainZones = {
  "zone1": "Zone 1: San Francisco / South SF / San Bruno",
  "zone2": "Zone 2: Millbrae to Redwood City",
  "zone3": "Zone 3: Menlo Park to Sunnyvale",
  "zone4": "Zone 4: Lawrence to Tamien",
  "zone5": "Zone 5: Capitol / Blossom",
  "zone6": "Zone 6: Morgan Hill / San Martin / Gilroy"
};

const smartZones = {
  "A": "Larkspur / San Rafael / Marin Civic Center",
  "B": "Novato Hamilton / Novato Downtown / Novato San Marin",
  "C": "Petaluma Downtown / Petaluma North / Cotati / Rohnert Park",
  "D": "Santa Rosa Downtown / Santa Rosa North",
  "E": "Sonoma County Airport / Windsor"
}

const SOZones = {
  "zone:1": "Santa Rosa",
  "zone:2": "Zone 2: Windsor and Healdsburg",
  "zone:3": "Sebastopol and Forestville",
  "zone:4": "Rohnert Park, Cotati, and Petaluma",
  "zone:5": "Kenwood and Glen Ellen",
  "zone:6": "Russian River and Coast",
  "zone:7": "Sonoma Valley",
  "zone:8": "Geyserville and Cloverdale"
}

// BART stops are inflated from stops.txt during initialization
let bartStops = {}

// ExtraFieldConfig defines fields used by zonal/station-based fare inputs
interface ExtraFieldConfig {
  type: "station" | "zone";
  labelFrom: string;
  labelTo: string;
  options: Record<string, string>;
}

const agencyExtraFields: Record<string, ExtraFieldConfig> = {
  "BA": { type: "station", labelFrom: "Starting station", labelTo: "Ending station", options: bartStops },
  "GG": { type: "zone", labelFrom: "Starting zone", labelTo: "Ending zone", options: ggtZones },
  "CT": { type: "zone", labelFrom: "Starting zone", labelTo: "Ending zone", options: caltrainZones },
  "SA": { type: "zone", labelFrom: "Starting station", labelTo: "Ending station", options: smartZones },
  "SO": { type: "zone", labelFrom: "Starting zone", labelTo: "Ending zone", options: SOZones },
};

const agencyNicknames: Record<string, string> = {
  "SF": "Muni",
  "BA": "BART",
  "SA": "SMART",
};

const nicknameLookup: Record<string, string> = {};
for (const [id, nickname] of Object.entries(agencyNicknames)) {
  nicknameLookup[nickname.toLowerCase()] = id;
}

// Agencies that have a local fare and a special fare that need to be treated differently
const specialAgencies: GTFSAgency[] = [
  { Id: "AC:transbay", Name: "AC Transit - Transbay", LastGenerated: "" },
  { Id: "SC:express", Name: "VTA - Express", LastGenerated: "" },
  { Id: "3D:regional", Name: "Tri-Delta Transit - 200X/201X", LastGenerated: "" },
  { Id: "DE:transbay", Name: "Dumbarton - Transbay", LastGenerated: "" },
  { Id: "VN:express", Name: "VINE Transit - Express", LastGenerated: "" },
  { Id: "GF:LSSF", Name: "Golden Gate Ferry - Larkspur", LastGenerated: "" },
  { Id: "GF:TBSF", Name: "Golden Gate Ferry - Tiburon", LastGenerated: "" },
  { Id: "GF:SSSF", Name: "Golden Gate Ferry - Sausalito", LastGenerated: "" },
  { Id: "GF:AISF", Name: "Golden Gate Ferry - Angel Island", LastGenerated: "" },
];

let fareRules: FareTransferRule[] = [];
let fareProducts: FareProduct[] = [];
let agencies: GTFSAgency[] = [];

interface AgencyInput {
  input: HTMLInputElement;
  extraFrom?: HTMLSelectElement;
  extraTo?: HTMLSelectElement;
}

const agencyInputs: AgencyInput[] = [];

const agencyList = document.getElementById("agencyDatalist") as HTMLDataListElement;
const agencyListContainer = document.getElementById("agencyListContainer")!;
const agencyDatalist = document.getElementById("agencyDatalist") as HTMLDataListElement;

const resultsDiv = document.getElementById("results")!;
const finalResultsDiv = document.getElementById("final-results")!;

const resultsC2Div = document.getElementById("results-c2")!;
const finalResultsC2Div = document.getElementById("final-results-c2")!;

const comparisonDiv = document.getElementById("comparison-inner")!;
const comparisonAnnualDiv = document.getElementById("comparison-inner-annual")!;

// basic CSV parsing - works with the input it's given, at least :)
function parseCSV<T>(content: string): T[] {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",").map(v => v.trim());
    const entry = {};
    headers.forEach((header, i) => {
      let value = values[i] ?? "";
      if (value === "") value = null;
      if (!isNaN(Number(value)) && value !== null && value !== "") entry[header] = Number(value);
      else entry[header] = value;
    });
    return entry as T;
  });
}

// GTFSAgency XML parser
async function parseAgenciesXML(xmlText: string): Promise<GTFSAgency[]> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const nodes = xmlDoc.getElementsByTagName("GTFSAgency");
  const ags: GTFSAgency[] = [];
  for (const node of Array.from(nodes)) {
    ags.push({
      Id: node.getAttribute("Id") ?? "",
      Name: node.getAttribute("Name") ?? "",
      LastGenerated: node.getAttribute("LastGenerated") ?? "",
    });
  }
  return ags;
}

// inflate a BART stops map: {stop_id => human readable name}
function inflateBARTStops(stops) {
  const stops_map = {}
  stops.forEach(stop => stops_map[String(stop.stop_id)] = stop.stop_name);
  return stops_map;
}

// populate the datalist used by the input fields
function populateAgencyDatalist() {
  agencyList.innerHTML = "";

  for (const a of agencies) {
    if (a.Id == "GF") continue; // only add the subtypes, as we need people to select specific runs
    const nickname = agencyNicknames[a.Id] ?? null;
    const label = nickname
      ? `${nickname} - ${a.Name} (${a.Id})`
      : `${a.Name} (${a.Id})`;

    const opt = document.createElement("option");
    opt.value = label;
    opt.dataset.id = a.Id;  // shadow ID for filtering
    agencyList.appendChild(opt);
  }
}

function getSelectedAgencyById(val: string) {
  return agencies.find(a => a.Id == val);
}

function agencyIdToDisplayName(val: string): string | null {
  const optId = Array.from(agencyDatalist.options).find((o: HTMLOptionElement) => o.dataset.id === val);
  if (optId) return optId.value ?? null;

  return null;
}

// load static files into globals
async function loadStaticFiles() {
  const [rulesText, productsText, stopsText, xmlText] = await Promise.all([
    fetch("static/fare_transfer_rules.txt").then(r => r.text()),
    fetch("static/fare_products.txt").then(r => r.text()),
    fetch("static/stops.txt").then(r => r.text()),
    fetch("static/gtfsoperators.xml").then(r => r.text())
  ]);

  fareRules = parseCSV<FareTransferRule>(rulesText);
  fareProducts = parseCSV<FareProduct>(productsText);
  bartStops = inflateBARTStops(parseCSV<Stop>(stopsText));
  agencyExtraFields["BA"].options = bartStops;

  agencies = await parseAgenciesXML(xmlText);

  // Add special agencies
  agencies.push(...specialAgencies);

  populateAgencyDatalist();
}

// initialize input fields
// process share hashes, if any, then add a new input field
function initializeInput() {
  agencyListContainer.style.display = "block";
  if (window.location.hash) {
    const segments = window.location.hash.slice(1).split("#");
    for (const segment of segments) {
      const legInfo = segment.split(';');
      addAgencyInput(legInfo[0]);
      if (legInfo.length === 3) {
        const from = decodeURIComponent(legInfo[1]);
        const to = decodeURIComponent(legInfo[2]);
        const ai = agencyInputs[agencyInputs.length-1];
        ai.extraFrom.selectedIndex = Array.from(ai.extraFrom.options).findIndex(opt => opt instanceof HTMLOptionElement && opt.value === from);
        ai.extraTo.selectedIndex = Array.from(ai.extraTo.options).findIndex(opt => opt instanceof HTMLOptionElement && opt.value === to);
      }
    }
    addAgencyInput();
    updateTransferResults();
  } else {
    // initialize first input field
    addAgencyInput();
  }
}

// resolve input string to an agency ID
function getSelectedAgencyId(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return null;

  // 1. Exact datalist match
  const opt = Array.from(agencyDatalist.options).find((o: HTMLOptionElement) => o.value === trimmed);
  if (opt) return opt.dataset.id ?? null;

  // 2. Nickname match
  const nicknameId = nicknameLookup[trimmed.toLowerCase()];
  if (nicknameId) return nicknameId;

  // 3. Partial name match
  const partial = agencies.find(a => a.Name.toLowerCase().includes(trimmed.toLowerCase()));
  return partial ? partial.Id : null;
}

// create a new agency <input>
function addAgencyInput(prefill?: string) {
  const div = document.createElement("div");
  const input = document.createElement("input");
  input.setAttribute("list", "agencyDatalist");
  input.placeholder = "Select or type agency to add...";
  if (prefill) input.value = agencyIdToDisplayName(prefill);

  div.appendChild(input);
  agencyListContainer.appendChild(div);

  agencyInputs.push({ input });

  if (prefill) onAgencyListChange(input, div, true);
  // Add change listener to handle extra fields
  input.addEventListener("change", () => onAgencyListChange(input, div, false));
}

// onAgencyListChange: upon changes to input list, update HTML, then call call updateTransferResults
function onAgencyListChange(input: HTMLInputElement, containerDiv: HTMLDivElement, disableInputCreation) {
  const val = input.value.trim();
  const agencyId = getSelectedAgencyId(val);
  const agencyRef = agencyInputs.find(a => a.input === input);

  if (val === "") {
    // val is empty, so we want to remove the field
    const removalIndex = Array.prototype.indexOf.call(agencyListContainer.children, input.parentElement!);
    agencyInputs.splice(removalIndex, removalIndex);
    input.parentElement!.remove();
    updateTransferResults();
    return;
  }

  if (!agencyId) {
    console.warn("Could not find agencyId for input:", val);
    return;
  }  

  if (!agencyRef) {
    console.warn("Could not find agencyRef for input:", val);
    return;
  }

  // Remove previous extra fields if they exist
  containerDiv.querySelectorAll(".extraField").forEach(e => e.remove());

  const config = agencyExtraFields[agencyId];
  if (config) {
    // From field
    const fromDiv = document.createElement("div");
    fromDiv.className = "extraField";
    const fromLabel = document.createElement("label");
    fromLabel.textContent = config.labelFrom;
    fromDiv.appendChild(fromLabel);

    const fromSelect = document.createElement("select");
    Object.keys(config.options).forEach(opt => {
      const optionEl = document.createElement("option");
      optionEl.value = opt;
      optionEl.textContent = config.options[opt];
      fromSelect.appendChild(optionEl);
    });
    fromSelect.addEventListener("change", () => updateTransferResults());
    fromDiv.appendChild(fromSelect);
    containerDiv.appendChild(fromDiv);

    // To field
    const toDiv = document.createElement("div");
    toDiv.className = "extraField";
    const toLabel = document.createElement("label");
    toLabel.textContent = config.labelTo;
    toDiv.appendChild(toLabel);

    const toSelect = document.createElement("select");
    Object.keys(config.options).forEach(opt => {
      const optionEl = document.createElement("option");
      optionEl.value = opt;
      optionEl.textContent = config.options[opt];
      toSelect.appendChild(optionEl);
    });
    toSelect.addEventListener("change", () => updateTransferResults());
    toDiv.appendChild(toSelect);
    containerDiv.appendChild(toDiv);

    // Store references
    agencyRef.extraFrom = fromSelect;
    agencyRef.extraTo = toSelect;
  } else {
    agencyRef.extraFrom = undefined;
    agencyRef.extraTo = undefined;
  }

  // Add new rolling input if last
  const lastInput = agencyInputs[agencyInputs.length - 1].input;
  if (lastInput.value.trim() !== "" && lastInput === input && !disableInputCreation) addAgencyInput();

  updateTransferResults();
}

/*
  Fare handling
*/

// static fares, ex: bus fares
function getFareForAgency(input: string): FareProduct[] {
  const fare_product_id = input.includes(":") ? `${input}:single` : `${input}:local:single`;

  return fareProducts.filter(
    (fare) =>
      fare.fare_media_id === "clipper" &&
      fare.fare_product_id === fare_product_id &&
      fare.rider_category_id === "adult" // TODO: allow selecting different rider categories?
  );
}

// dynamic / zonal fares, ex: BART, Caltrain
function calculateFare(agencyId, from, to): number | undefined {
  if (["GG", "SO", "SA", "CT"].includes(agencyId)) {
    return (fareProducts.filter(
      (fare) =>
      fare.fare_media_id === "clipper" &&
      fare.rider_category_id === "adult" &&
      (fare.fare_product_id === `${agencyId}:matrix:${agencyId}:${from}-${agencyId}:${to}` || fare.fare_product_id === `${agencyId}:matrix:${agencyId}:${to}-${agencyId}:${from}`)
    )[0] || {})?.amount;
  } else if (agencyId == "BA") {
    return (fareProducts.filter(
      (fare) =>
      fare.fare_media_id === "clipper" &&
      fare.rider_category_id === "adult" &&
      fare.fare_product_id === `BA:matrix:${from}-${to}`
    )[0] || {})?.amount;
  }
  return undefined;
}

// dispatch fare calculation to correct handler
function getFare(agencyInput, agencyId): number | undefined {
  if (agencyId in agencyExtraFields) {
    if (agencyInput.extraFrom && agencyInput.extraTo) {
      return calculateFare(agencyId, agencyInput.extraFrom?.value, agencyInput.extraTo?.value);
    }
  } else {
    return getFareForAgency(agencyId)[0]?.amount;
  }
}

// add a leg to the output display
function appendLegDetails(div, fare, agencyInput, agencyId, discount, i) {
  const h4Leg = document.createElement("h4");
  h4Leg.textContent = `Leg ${i + 1}: ${getSelectedAgencyById(agencyId)?.Name}`;
  div.appendChild(h4Leg);
  const d = document.createElement("div");
  if (discount !== undefined) {
    if (discount >= 0) d.innerHTML = `Base fare: $${fare.toFixed(2)}<br>Transfer discount: -$${(discount-fare).toFixed(2)}<br><b>Subtotal fare:</b> $${discount.toFixed(2)}`
    else d.innerHTML = `Base fare: $${fare.toFixed(2)}<br>Transfer discount: -$${Math.min(fare, -discount).toFixed(2)}<br><b>Subtotal fare:</b> $${Math.max(0, fare+discount).toFixed(2)}`
  } else {
    d.textContent = `Fare: $${fare.toFixed(2)}`
  }
  div.appendChild(d);
}


// called when input is updated. calculates running fare totals for both C1 and C2 and creates output displays
function updateTransferResults() {
  const outputElements = document.querySelectorAll('.output') as NodeListOf<HTMLElement>;
  if (agencyInputs.length <= 1) {
    outputElements.forEach(element => {
      element.style.display = 'none';
    });
  } else {
    outputElements.forEach(element => {
      element.style.display = 'grid';
    });
  }

  /*
    Clipper 1 handling
  */
  resultsDiv.innerHTML = "";
  let agencyId = getSelectedAgencyId(agencyInputs[0].input.value.trim());
  const fare = getFare(agencyInputs[0], agencyId);
  if (!fare) {
    return;
  }
  let runningTotal = fare;
  appendLegDetails(resultsDiv, fare, agencyInputs[0], agencyId, undefined, 0);

  for (let i = 0; i < agencyInputs.length - 1; i++) {
    const fromVal = agencyInputs[i].input.value.trim();
    const toVal = agencyInputs[i + 1].input.value.trim();
    if (!fromVal || !toVal) continue;

    let fromId = getSelectedAgencyId(fromVal);
    let toId = getSelectedAgencyId(toVal);
    if (!fromId || !toId) continue;

    const nextFare = getFare(agencyInputs[i+1], toId);
    if (!nextFare) {
      continue;
    }

    // Golden Gate Ferry: transfer rules are global, not by line, so we need to trim the line suffix (GF:SSSF -> GF)
    if (fromId.startsWith("GF")) { fromId = "GF" };
    if (toId.startsWith("GF")) { toId = "GF" };
  
    // take the first match as the correct match
    const transferRule = fareRules.filter(r => r.from_leg_group_id === fromId && r.to_leg_group_id === toId)[0];
    const discount = transferRule ? fareProducts.find(p => p.fare_product_id === transferRule.fare_product_id)?.amount : undefined;
  
    appendLegDetails(resultsDiv, nextFare, agencyInputs[i+1], toId, discount, i+1);

    if (discount !== undefined) {
      if (discount > 0) {
        runningTotal += discount;
      } else if (discount < 0 && nextFare > -discount) {
        runningTotal = runningTotal + nextFare + discount;
      }
    } else {
      runningTotal += nextFare;
    }
  }
  
  finalResultsDiv.innerHTML = "";
  const h3 = document.createElement("h3");
  h3.textContent = `Total fare: $${runningTotal.toFixed(2)}`;
  finalResultsDiv.appendChild(h3);

  /*
    Clipper 2.0 handling
  */
  resultsC2Div.innerHTML = "";
  agencyId = getSelectedAgencyId(agencyInputs[0].input.value.trim());
  let runningTotalC2 = getFare(agencyInputs[0], agencyId);
  if (!runningTotalC2) {
    return;
  }
  appendLegDetails(resultsC2Div, runningTotalC2, agencyInputs[0], agencyId, undefined, 0);

  let previousFare = runningTotalC2!;
  let discount;
  for (let i = 1; i < agencyInputs.length - 1; i++) {
    if (previousFare < 2.85) {
      discount = -previousFare
    } else {
      discount = -2.85;
    }
    agencyId = getSelectedAgencyId(agencyInputs[i].input.value.trim());
    const nextFare = getFare(agencyInputs[i], agencyId)!;
    if (!runningTotalC2) {
      continue;
    }
    appendLegDetails(resultsC2Div, nextFare, agencyInputs[i], agencyId, discount, i);
    if (nextFare > 2.85) {
      runningTotalC2 = runningTotalC2 + nextFare + discount;
    }
    previousFare = nextFare;
  }

  finalResultsC2Div.innerHTML = "";
  const h3c2 = document.createElement("h3");
  h3c2.textContent = `Total fare with Clipper 2.0: $${runningTotalC2!.toFixed(2)}`;
  finalResultsC2Div.appendChild(h3c2);

  /*
    Final comparison output handling
  */
  const savings = runningTotal - runningTotalC2!; 
  comparisonDiv.innerHTML = "";
  const h2comp = document.createElement("h2");
  h2comp.textContent = `$${savings.toFixed(2)}`;
  comparisonDiv.appendChild(h2comp);

  comparisonAnnualDiv.innerHTML = "";
  const h2compAnnual = document.createElement("h2");
  h2compAnnual.textContent = `$${(savings*500).toFixed(2)}`;
  comparisonAnnualDiv.appendChild(h2compAnnual);
}

/*
  Buttons
*/
const clear = document.getElementById("clear");
clear?.addEventListener("click", async () => {
  agencyInputs.length = 0;
  agencyListContainer.innerHTML = "";
  addAgencyInput();
  updateTransferResults();
})

const share = document.getElementById("share");
share?.addEventListener("click", async () => {
  let urlHash = "";
  for (const ai of agencyInputs) {
    if (!ai.input.value.trim()) {
      continue;
    }
    urlHash += "#"
    urlHash += getSelectedAgencyId(ai.input.value.trim());
    if (ai.extraFrom) {
      urlHash += ";"
      urlHash += ai.extraFrom.options[ai.extraFrom.selectedIndex].value;
    }
    if (ai.extraTo) {
      urlHash += ";"
      urlHash += ai.extraTo.options[ai.extraTo.selectedIndex].value;
    }
  }
  const shareData = {
    title: "Clipper 2.0 Savings Calculator",
    text: `I'm going to save ${comparisonAnnualDiv.innerText} every year with Clipper 2.0! How much will you save?\n`,
    url: `${window.location.origin}/${urlHash}`,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.warn(err);
    }
  } else {
    const shareDiv = document.getElementById("share-div")!;
    navigator.clipboard.writeText(shareData.url);
    shareDiv.innerText = "Copied link to clipboard!";
  }
});

loadStaticFiles().then(initializeInput).catch(err => {
  console.error("Error loading static files:", err);
  resultsDiv.textContent = "Failed to load static GTFS files.";
});
