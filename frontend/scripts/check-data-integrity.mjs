// Plain-Node data integrity check for the California-only mock dataset.
// No test framework: run with `node scripts/check-data-integrity.mjs`.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data")
const readJson = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"))

const stations = readJson("stations.json")
const chargers = readJson("chargers.json")
const actions = readJson("actions.json")
const forecasts = readJson("forecasts.json")
const meta = readJson("meta.json")

const stationIds = new Set(stations.map((s) => s.id))

// 1/2. Every active station is a California station, no Malaysian records remain.
for (const station of stations) {
  assert.equal(station.region, "california", `non-California station found: ${station.id}`)
}
const malaysiaMarkers = ["malaysia", "kuala lumpur", "seremban", "melaka", "johor", "putrajaya", "cyberjaya"]
const haystack = JSON.stringify({ stations, chargers, actions, forecasts, meta }).toLowerCase()
for (const marker of malaysiaMarkers) {
  assert.ok(!haystack.includes(marker), `Malaysia-related marker "${marker}" still present in active mock data`)
}

// 3. Station IDs are unique.
assert.equal(stationIds.size, stations.length, "duplicate station IDs found")

// 4. Duplicate coordinates are preserved (California_Garage_01 and 02 must both exist, same coords, distinct IDs).
const g1 = stations.find((s) => s.id === "California_Garage_01")
const g2 = stations.find((s) => s.id === "California_Garage_02")
assert.ok(g1 && g2, "expected California_Garage_01 and California_Garage_02 to both be present")
assert.equal(g1.lat, g2.lat, "duplicate-coordinate stations must keep matching latitude")
assert.equal(g1.lon, g2.lon, "duplicate-coordinate stations must keep matching longitude")

// 5. Every charger references a valid station.
for (const charger of chargers) {
  assert.ok(stationIds.has(charger.station_id), `charger ${charger.charger_id} references unknown station ${charger.station_id}`)
}

// 6. Every action references a valid station.
for (const action of actions) {
  assert.ok(stationIds.has(action.station_id), `action rank ${action.rank} references unknown station ${action.station_id}`)
}

// 7. Every forecast references a valid station.
for (const forecast of forecasts) {
  assert.ok(stationIds.has(forecast.station_id), `forecast entry references unknown station ${forecast.station_id}`)
}

// Expected authoritative registry (exact IDs and coordinates, per migration spec).
const expected = {
  California_Garage_01: [34.134765, -118.127183],
  S_Wilson_Garage_01: [34.140269, -118.128354],
  California_Garage_02: [34.134765, -118.127183],
  Arroyo_Garage_01: [34.198841, -118.170402],
}
for (const [id, [lat, lon]] of Object.entries(expected)) {
  const station = stations.find((s) => s.id === id)
  assert.ok(station, `expected authoritative station ${id} to be present`)
  assert.equal(station.lat, lat, `${id} latitude must not be rounded or replaced`)
  assert.equal(station.lon, lon, `${id} longitude must not be rounded or replaced`)
}
assert.equal(stations.length, Object.keys(expected).length, "unexpected extra or missing stations in registry")

// 12. Timezone uses California rules (IANA zone, not a hardcoded fixed offset).
assert.equal(meta.timezone, "America/Los_Angeles", "meta.timezone must be the IANA California zone")
assert.ok(meta.currency, "meta.currency must be present for currency-aware formatting")

console.log(`OK — ${stations.length} California stations, ${chargers.length} charger overrides, ${actions.length} actions, ${forecasts.length} forecast profiles. No Malaysia markers found.`)
