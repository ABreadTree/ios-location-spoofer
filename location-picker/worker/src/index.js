/**
 * iOS Location Picker — Cloudflare Worker
 *
 * API（与 location-picker/server.js 兼容）：
 *   GET  /loc.json?token=   → 读取坐标 JSON（Loon / Shadowrocket configUrl）
 *   POST /set?token=        → 保存坐标
 *   GET/POST /favorites?token= → 读取 / 新增收藏位置
 *   DELETE /favorites/:id?token= → 删除收藏位置
 *   POST /schedule?token=   → 保存定时开关
 *   GET  /?token=           → 地图选点网页
 */

import { PAGE } from "./page.js";

const KV_KEY = "loc";
const FAV_KEY = "favorites";

const DEFAULT = {
  enabled: true,
  latitude: 37.3349,
  longitude: -122.00902,
  altitude: 530,
  horizontalAccuracy: 39,
  verticalAccuracy: 1000,
  scheduleTimeZone: "Asia/Singapore",
  schedules: [],
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

function textResponse(body, contentType, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

function unauthorized() {
  return jsonResponse({ error: "bad token" }, 403);
}

function checkToken(request, env) {
  const configured = env.TOKEN;
  if (!configured) {
    return { ok: false, error: "server misconfigured: TOKEN secret not set" };
  }
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (token !== configured) {
    return { ok: false, error: "bad token" };
  }
  return { ok: true };
}

async function readLoc(env) {
  try {
    const raw = await env.LOC_KV.get(KV_KEY);
    if (!raw) {
      return { ...DEFAULT };
    }
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT };
  }
}

async function writeLoc(env, obj) {
  await env.LOC_KV.put(KV_KEY, JSON.stringify(obj));
}

async function readFavs(env) {
  try {
    const raw = await env.LOC_KV.get(FAV_KEY);
    const favs = raw ? JSON.parse(raw) : [];
    return Array.isArray(favs) ? favs : [];
  } catch {
    return [];
  }
}

async function writeFavs(env, favs) {
  await env.LOC_KV.put(FAV_KEY, JSON.stringify(favs.slice(0, 50)));
}

function setInt(target, key, value) {
  if (value !== undefined && value !== null && value !== "" && Number.isFinite(Number(value))) {
    target[key] = Math.round(Number(value));
  }
}

function validTime(value) {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(String(value || "").trim());
}

function locFromBody(j) {
  const la = Number(j.lat);
  const lo = Number(j.lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
    return null;
  }
  const out = { latitude: la, longitude: lo };
  setInt(out, "altitude", j.altitude);
  setInt(out, "horizontalAccuracy", j.horizontalAccuracy);
  setInt(out, "verticalAccuracy", j.verticalAccuracy);
  return out;
}

function locFromSchedule(s) {
  const loc = s && s.location;
  if (!loc) {
    return null;
  }
  const la = Number(loc.latitude);
  const lo = Number(loc.longitude);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
    return null;
  }
  const out = { latitude: la, longitude: lo };
  setInt(out, "altitude", loc.altitude);
  setInt(out, "horizontalAccuracy", loc.horizontalAccuracy);
  setInt(out, "verticalAccuracy", loc.verticalAccuracy);
  return out;
}

function schedulesFromBody(j) {
  if (!Array.isArray(j.schedules)) {
    return null;
  }
  return j.schedules.slice(0, 20).map((s, i) => {
    const days = Array.isArray(s.days)
      ? s.days.map(Number).filter((d, idx, a) => d >= 1 && d <= 7 && a.indexOf(d) === idx)
      : [];
    const out = {
      id: String(s.id || Date.now() + "-" + i),
      enabled: s.enabled !== false,
      start: validTime(s.start) ? String(s.start).trim() : "09:00",
      end: validTime(s.end) ? String(s.end).trim() : "17:00",
      days,
    };
    if (s.favoriteId != null) out.favoriteId = String(s.favoriteId).slice(0, 80);
    if (s.favoriteName != null) out.favoriteName = String(s.favoriteName).trim().slice(0, 40);
    const loc = locFromSchedule(s);
    if (loc) out.location = loc;
    return out;
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const auth = checkToken(request, env);

    if (url.pathname === "/loc.json" && request.method === "GET") {
      if (!auth.ok) {
        return unauthorized();
      }
      const loc = await readLoc(env);
      return jsonResponse(loc);
    }

    if (url.pathname === "/set" && request.method === "POST") {
      if (!auth.ok) {
        return unauthorized();
      }
      let bodyText;
      try {
        bodyText = await request.text();
        if (bodyText.length > 10000) {
          return jsonResponse({ error: "payload too large" }, 413);
        }
        const j = JSON.parse(bodyText);
        const la = Number(j.lat);
        const lo = Number(j.lng);
        if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180) {
          return jsonResponse({ error: "bad coords" }, 400);
        }
        const cur = await readLoc(env);
        cur.latitude = la;
        cur.longitude = lo;
        cur.enabled = true;
        setInt(cur, "altitude", j.altitude);
        setInt(cur, "horizontalAccuracy", j.horizontalAccuracy);
        setInt(cur, "verticalAccuracy", j.verticalAccuracy);
        await writeLoc(env, cur);
        return jsonResponse(cur);
      } catch {
        return jsonResponse({ error: "bad json" }, 400);
      }
    }

    if (url.pathname === "/favorites" && request.method === "GET") {
      if (!auth.ok) {
        return unauthorized();
      }
      return jsonResponse(await readFavs(env));
    }

    if (url.pathname === "/favorites" && request.method === "POST") {
      if (!auth.ok) {
        return unauthorized();
      }
      try {
        const bodyText = await request.text();
        if (bodyText.length > 10000) {
          return jsonResponse({ error: "payload too large" }, 413);
        }
        const j = JSON.parse(bodyText);
        const loc = locFromBody(j);
        if (!loc) {
          return jsonResponse({ error: "bad coords" }, 400);
        }
        const fav = {
          ...loc,
          id: String(Date.now()),
          name: String(j.name || "收藏位置").trim().slice(0, 40) || "收藏位置",
        };
        const favs = (await readFavs(env)).filter((x) => x.id !== fav.id);
        favs.unshift(fav);
        await writeFavs(env, favs);
        return jsonResponse(favs);
      } catch {
        return jsonResponse({ error: "bad json" }, 400);
      }
    }

    if (url.pathname.startsWith("/favorites/") && request.method === "DELETE") {
      if (!auth.ok) {
        return unauthorized();
      }
      const id = decodeURIComponent(url.pathname.slice("/favorites/".length));
      const favs = (await readFavs(env)).filter((x) => String(x.id) !== id);
      await writeFavs(env, favs);
      return jsonResponse(favs);
    }

    if (url.pathname === "/schedule" && request.method === "POST") {
      if (!auth.ok) {
        return unauthorized();
      }
      try {
        const bodyText = await request.text();
        if (bodyText.length > 20000) {
          return jsonResponse({ error: "payload too large" }, 413);
        }
        const schedules = schedulesFromBody(JSON.parse(bodyText));
        if (!schedules) {
          return jsonResponse({ error: "bad schedules" }, 400);
        }
        const cur = await readLoc(env);
        cur.scheduleTimeZone = "Asia/Singapore";
        cur.schedules = schedules;
        await writeLoc(env, cur);
        return jsonResponse(cur);
      } catch {
        return jsonResponse({ error: "bad json" }, 400);
      }
    }

    if ((url.pathname === "/" || url.pathname === "") && request.method === "GET") {
      // 地图页允许无 token 打开，但保存/读取 API 仍需 token
      return textResponse(PAGE, "text/html; charset=utf-8");
    }

    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, kv: !!env.LOC_KV, tokenConfigured: !!env.TOKEN });
    }

    return textResponse("not found", "text/plain", 404);
  },
};
