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
  "BA": { type: "station", labelFrom: "From", labelTo: "To", options: bartStops },
  "GG": { type: "zone", labelFrom: "Starting zone", labelTo: "Ending zone", options: ggtZones },
  "CT": { type: "zone", labelFrom: "Starting zone", labelTo: "Ending zone", options: caltrainZones },
  "SA": { type: "zone", labelFrom: "From", labelTo: "To", options: smartZones },
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

// Agencies that need to be excluded - free or no Clipper fares, no default local fare (GF, SB)
const exlcudedAgencies = ['AM', 'AF', 'CE', 'CM', 'EE', 'EM', 'GP', 'MB', 'MC', 'PE', 'RG', 'MV', 'PG', 'SI', 'SS', 'TF', 'RV', 'GF', 'SB'];

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
  { Id: "SB:HB", Name: "San Francisco Bay Ferry: Harbor Bay", LastGenerated: "" },
  { Id: "SB:SEA", Name: "San Francisco Bay Ferry: Alameda Seaplane", LastGenerated: "" },
  { Id: "SB:OA", Name: "San Francisco Bay Ferry: Oakland & Alameda", LastGenerated: "" },
  { Id: "SB:RCH", Name: "San Francisco Bay Ferry: Richmond", LastGenerated: "" },
  { Id: "SB:SSF", Name: "San Francisco Bay Ferry: South San Francisco", LastGenerated: "" },
  { Id: "SB:VJO", Name: "San Francisco Bay Ferry: Vallejo", LastGenerated: "" },
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

const resultsDiv = document.getElementById("results")!;
const finalResultsDiv = document.getElementById("final-results")!;

const resultsC2Div = document.getElementById("results-c2")!;
const finalResultsC2Div = document.getElementById("final-results-c2")!;

const comparisonDiv = document.getElementById("comparison-inner")!;
const comparisonAnnualDiv = document.getElementById("comparison-inner-annual")!;

const shareEl = document.getElementById("share-text")!;

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
    if (exlcudedAgencies.includes(a.Id)) continue;
    const nickname = agencyNicknames[a.Id] ?? null;
    const label = nickname
      ? `${nickname} - ${a.Name}`
      : `${a.Name}`;

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
  const optId = Array.from(agencyList.options).find((o: HTMLOptionElement) => o.dataset.id === val);
  if (optId) return optId.value ?? null;

  return "";
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

function loadFromHash(h: string) {
  clearInputs();
  const segments = h.slice(1).split("#");
  console.log(segments);
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
}

// initialize input fields
// process share hashes, if any, then add a new input field
function initializeInput() {
  agencyListContainer.style.display = "block";
  if (window.location.hash) {
    loadFromHash(window.location.hash);
    window.location.hash = "";
  }
  addAgencyInput();
  updateTransferResults();
}

// resolve input string to an agency ID
function getSelectedAgencyId(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return null;

  // 1. Exact datalist match
  const opt = Array.from(agencyList.options).find((o: HTMLOptionElement) => o.value === trimmed);
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
  console.log("called");
  const div = document.createElement("div");
  const input = document.createElement("input");
  input.className = "w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[var(--transbay-teal)] mt-6";
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

  shareEl.textContent = "";

  if (val === "") {
    // val is empty, so we want to remove the field
    const removalIndex = Array.prototype.indexOf.call(agencyListContainer.children, input.parentElement!);
    agencyInputs.splice(removalIndex, 1);
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

  input.value = agencyIdToDisplayName(agencyId);

  // Remove previous extra fields if they exist
  containerDiv.querySelectorAll(".extraField").forEach(e => e.remove());

  const config = agencyExtraFields[agencyId];
  if (config) {
    // From field
    const fromDiv = document.createElement("div");
    fromDiv.className = "extraField flex flex-col md:flex-row md:items-center md:space-x-4";
    const fromLabel = document.createElement("label");
    fromLabel.className = "block font-medium text-slate-700 mb-2 md:mb-0 w-40";
    fromLabel.textContent = config.labelFrom;
    fromDiv.appendChild(fromLabel);

    const fromSelect = document.createElement("select");
    fromSelect.className = "w-full max-w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[var(--transbay-teal)] bg-white";
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
    toDiv.className = "extraField flex flex-col md:flex-row md:items-center md:space-x-4";
    const toLabel = document.createElement("label");
    toLabel.className = "block font-medium text-slate-700 mb-2 md:mb-0 w-40";
    toLabel.textContent = config.labelTo;
    toDiv.appendChild(toLabel);

    const toSelect = document.createElement("select");
    toSelect.className = "w-full max-w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[var(--transbay-teal)] bg-white";
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
  if (!input) {return [] }
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
function appendLegDetails(div, agencyId, fare, discount, i) {
  const spanLeg = document.createElement("span");
  spanLeg.className = "font-bold mt-6";
  spanLeg.textContent = `Leg ${i + 1}: ${getSelectedAgencyById(agencyId)?.Name}`;
  div.appendChild(spanLeg);
  const d = document.createElement("div");
  if (discount !== undefined) {
    if (discount >= 0) {
      d.innerHTML = `Base fare: $${fare.toFixed(2)}<br>Transfer discount: -$${(fare - discount).toFixed(2)}<br><b>Subtotal fare:</b> $${discount.toFixed(2)}`
    } else {
      const discountedFare = Math.max(0, fare + discount);
      const discountValue = fare - discountedFare;
      d.innerHTML = `Base fare: $${fare.toFixed(2)}<br>Transfer discount: -$${discountValue.toFixed(2)}<br><b>Subtotal fare:</b> $${discountedFare.toFixed(2)}`
    }
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
    return;
  } else {
    outputElements.forEach(element => {
      element.style.display = 'grid';
    });
  }

  let agencyId = getSelectedAgencyId(agencyInputs[0].input.value.trim());

  /*
    Clipper 1 handling
  */
  resultsDiv.innerHTML = "";
  const fare = getFare(agencyInputs[0], agencyId);
  if (!fare) {
    return;
  }
  let runningTotal = fare;
  appendLegDetails(resultsDiv, agencyId, fare, undefined, 0);

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

    let displayToId = toId;

    // Golden Gate Ferry & Bay Ferry: transfer rules are global, not by line, so we need to trim the line suffix (GF:SSSF -> GF)
    if (fromId.startsWith("GF")) { fromId = "GF" };
    if (toId.startsWith("GF")) { toId = "GF" };

    if (fromId.startsWith("SB")) { fromId = "SB" };
    if (toId.startsWith("SB")) { toId = "SB" };
  
    // take the first match as the correct match
    const transferRule = fareRules.filter(r => r.from_leg_group_id === fromId && r.to_leg_group_id === toId)[0];
    const discount = transferRule ? fareProducts.find(p => p.fare_product_id === transferRule.fare_product_id)?.amount : undefined;
  
    appendLegDetails(resultsDiv, displayToId, nextFare, discount, i+1);

    if (discount !== undefined) {
      // positive discount is a replacement fare
      if (discount > 0) {
        runningTotal += discount;
      // negative discount is a fare discount
      } else if (discount < 0 && nextFare > -discount) {
        runningTotal = runningTotal + nextFare + discount;
      }
    // no discount is no discount
    } else {
      runningTotal += nextFare;
    }
  }
  
  finalResultsDiv.innerHTML = "";
  const span = document.createElement("span");
  span.className = "font-bold mt-12";
  span.textContent = `Total fare: $${runningTotal.toFixed(2)}`;
  finalResultsDiv.appendChild(span);

  /*
    Clipper 2.0 handling
  */
  resultsC2Div.innerHTML = "";
  agencyId = getSelectedAgencyId(agencyInputs[0].input.value.trim());
  let runningTotalC2 = getFare(agencyInputs[0], agencyId);
  if (!runningTotalC2) {
    return;
  }
  appendLegDetails(resultsC2Div, agencyId, runningTotalC2, undefined, 0);

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
    appendLegDetails(resultsC2Div, agencyId, nextFare, discount, i);
    if (nextFare > 2.85) {
      runningTotalC2 = runningTotalC2 + nextFare + discount;
    }
    previousFare = nextFare;
  }

  finalResultsC2Div.innerHTML = "";
  const spanc2 = document.createElement("span");
  spanc2.className = "font-bold mt-12";
  spanc2.textContent = `Total fare with Clipper 2.0: $${runningTotalC2!.toFixed(2)}`;
  finalResultsC2Div.appendChild(spanc2);

  /*
    Final comparison output handling
  */
  const savings = runningTotal - runningTotalC2!; 
  comparisonDiv.innerHTML = "";
  const spancomp = document.createElement("span");
  spancomp.textContent = `$${savings.toFixed(2)}`;
  comparisonDiv.appendChild(spancomp);

  comparisonAnnualDiv.innerHTML = "";
  const spancompAnnual = document.createElement("span");
  spancompAnnual.textContent = '$' + new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(savings*500);
  comparisonAnnualDiv.appendChild(spancompAnnual);
}

function clearInputs() {
  window.location.hash = "";
  agencyInputs.length = 0;
  agencyListContainer.innerHTML = "";
}

/*
  Buttons
*/
const loadHashButtons = document.querySelectorAll('.stored-trip') as NodeListOf<HTMLElement>;
for (const b of loadHashButtons) {
  b.addEventListener("click", () => {
    clearInputs();
    loadFromHash(b.dataset.hash!);
    addAgencyInput();
    updateTransferResults();
  });
}

const clear = document.getElementById("clear");
clear?.addEventListener("click", () => {
  clearInputs();
  addAgencyInput();
  updateTransferResults();
});

function calculateUrlHash() {
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
  return urlHash;
}

const share = document.getElementById("share");
share?.addEventListener("click", async () => {
  const urlHash = calculateUrlHash();
  const shareData = {
    title: "Clipper 2.0 Savings Calculator",
    text: `I'm could save ${comparisonAnnualDiv.innerText} every year with Clipper 2.0! How much will you save?\n`,
    url: `${window.location.origin}/${urlHash}`,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.warn(err);
    }
  } else {
    navigator.clipboard.writeText(shareData.url);
    shareEl.innerText = "Copied link to clipboard!";
  }
});

loadStaticFiles().then(initializeInput).catch(err => {
  console.error("Error loading static files:", err);
  resultsDiv.textContent = "Failed to load static GTFS files.";
});
