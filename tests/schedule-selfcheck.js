const assert = require("assert");
const api = require("../location-spoofer.js");

function at(iso) {
  return new Date(iso);
}

const mondayWorkHours = {
  id: "work",
  name: "Work hours",
  enabled: true,
  start: "09:00",
  end: "17:00",
  days: [1]
};

const mondayNight = {
  id: "night",
  name: "Night",
  enabled: true,
  start: "22:00",
  end: "02:00",
  days: [1]
};

assert.strictEqual(
  api.effectiveScheduleEnabled({ enabled: true }, at("2026-07-06T02:30:00Z")),
  true,
  "empty schedules keep enabled=true"
);

assert.strictEqual(
  api.effectiveScheduleEnabled({ enabled: false, schedules: [mondayWorkHours] }, at("2026-07-06T02:30:00Z")),
  false,
  "enabled=false disables even inside a schedule"
);

assert.strictEqual(
  api.effectiveScheduleEnabled({ enabled: true, schedules: [mondayWorkHours] }, at("2026-07-06T02:30:00Z")),
  true,
  "Monday 10:30 SGT matches Monday 09:00-17:00"
);

assert.strictEqual(
  api.effectiveScheduleEnabled({ enabled: true, schedules: [mondayWorkHours] }, at("2026-07-06T10:00:00Z")),
  false,
  "Monday 18:00 SGT misses Monday 09:00-17:00"
);

assert.strictEqual(
  api.effectiveScheduleEnabled({
    enabled: true,
    schedules: [Object.assign({}, mondayWorkHours, { enabled: false })]
  }, at("2026-07-06T02:30:00Z")),
  true,
  "all schedules disabled keeps enabled=true behavior"
);

assert.strictEqual(
  api.effectiveScheduleEnabled({ enabled: true, schedules: [mondayNight] }, at("2026-07-06T15:00:00Z")),
  true,
  "Monday 23:00 SGT matches Monday 22:00-02:00"
);

assert.strictEqual(
  api.effectiveScheduleEnabled({ enabled: true, schedules: [mondayNight] }, at("2026-07-06T17:00:00Z")),
  true,
  "Tuesday 01:00 SGT matches Monday 22:00-02:00"
);

assert.strictEqual(
  api.effectiveScheduleEnabled({ enabled: true, schedules: [mondayNight] }, at("2026-07-06T19:00:00Z")),
  false,
  "Tuesday 03:00 SGT misses Monday 22:00-02:00"
);

const overlapping = api.applyScheduleConfig({
  enabled: true,
  latitude: 0,
  longitude: 0,
  altitude: 1,
  horizontalAccuracy: 2,
  verticalAccuracy: 3,
  schedules: [
    Object.assign({}, mondayWorkHours, {
      location: {
        latitude: 11,
        longitude: 22,
        altitude: 33,
        horizontalAccuracy: 44,
        verticalAccuracy: 55
      }
    }),
    Object.assign({}, mondayWorkHours, {
      location: {
        latitude: 66,
        longitude: 77,
        altitude: 88,
        horizontalAccuracy: 99,
        verticalAccuracy: 111
      }
    })
  ]
}, at("2026-07-06T02:30:00Z"));

assert.strictEqual(overlapping.enabled, true, "matched schedule enables spoofing");
assert.strictEqual(overlapping.latitude, 11, "first matching schedule latitude wins");
assert.strictEqual(overlapping.longitude, 22, "first matching schedule longitude wins");
assert.strictEqual(overlapping.altitude, 33, "first matching schedule altitude wins");
assert.strictEqual(overlapping.horizontalAccuracy, 44, "first matching schedule horizontal accuracy wins");
assert.strictEqual(overlapping.verticalAccuracy, 55, "first matching schedule vertical accuracy wins");

console.log("schedule self-check passed");
