const { generateVimshottariDasha } = require('./vimshottariService');
const { normalizeDateToYmd } = require('./utils');

/** Generic per-lord tone for v1 family horizon (Option A baseline). Aligns with PRATYADASHA_YEAR_OVERVIEW_EPICS. */
const LORD_TONE = {
  Sun: 'mixed',
  Moon: 'favorable',
  Mars: 'mixed',
  Rahu: 'challenging',
  Jupiter: 'favorable',
  Saturn: 'mixed',
  Mercury: 'favorable',
  Ketu: 'challenging',
  Venus: 'favorable',
};

/** ±14 days window for grouping concurrent transitions across members. */
const TRANSITION_CLUSTER_DAYS = 14;

function clampToWindow(seg, winStart, winEnd) {
  const segStart = new Date(seg.start);
  const segEnd = new Date(seg.end);
  const start = segStart < winStart ? winStart : segStart;
  const end = segEnd > winEnd ? winEnd : segEnd;
  return { start, end };
}

/**
 * For one member, return ordered Maha/Antar pairs that intersect [winStart, winEnd]
 * plus the next antar transition after `now` (even if outside the window).
 */
function computeMemberLane(member, winStart, winEnd, now) {
  const date = normalizeDateToYmd(member.date);
  const time = member.time;
  const lat = Number(member.lat);
  const lng = Number(member.lng);
  const tz = Number(member.timezone);

  const { mahaDashas, antarDashasByMaha } = generateVimshottariDasha(date, time, lat, lng, tz, 120);

  const segments = [];
  let nextTransition = null;

  for (let m = 0; m < mahaDashas.length; m++) {
    const maha = mahaDashas[m];
    const antars = antarDashasByMaha[m] || [];
    for (const antar of antars) {
      const aStart = new Date(antar.start);
      const aEnd = new Date(antar.end);
      if (aEnd <= winStart) continue;
      if (aStart >= winEnd) break;
      const { start, end } = clampToWindow(antar, winStart, winEnd);
      if (start >= end) continue;
      segments.push({
        mahaLord: maha.lord,
        antarLord: antar.antarLord,
        start: start.toISOString(),
        end: end.toISOString(),
        tone: LORD_TONE[antar.antarLord] || 'mixed',
        summaryKey: `${maha.lord.toLowerCase()}.${antar.antarLord.toLowerCase()}`,
      });
    }
    if (new Date(maha.start) >= winEnd) break;
  }

  for (let m = 0; m < mahaDashas.length; m++) {
    const maha = mahaDashas[m];
    const antars = antarDashasByMaha[m] || [];
    for (const antar of antars) {
      const aEnd = new Date(antar.end);
      if (aEnd > now) {
        nextTransition = {
          type: 'antar',
          date: antar.end,
          fromMahaLord: maha.lord,
          fromAntarLord: antar.antarLord,
        };
        break;
      }
    }
    if (nextTransition) break;
  }

  return { segments, nextTransition };
}

function buildOverview(lanes, winStart, winEnd) {
  const transitionsInWindow = [];
  for (const lane of lanes) {
    const segs = Array.isArray(lane.segments) ? lane.segments : [];
    for (let i = 0; i < segs.length - 1; i++) {
      const cur = segs[i];
      const next = segs[i + 1];
      if (cur.end === next.start) {
        const tDate = new Date(cur.end);
        if (tDate >= winStart && tDate <= winEnd) {
          transitionsInWindow.push({
            memberId: lane.memberId,
            displayName: lane.displayName,
            date: cur.end,
            fromAntarLord: cur.antarLord,
            toAntarLord: next.antarLord,
          });
        }
      }
    }
  }
  transitionsInWindow.sort((a, b) => new Date(a.date) - new Date(b.date));

  const clusters = [];
  const used = new Set();
  for (let i = 0; i < transitionsInWindow.length; i++) {
    if (used.has(i)) continue;
    const seed = transitionsInWindow[i];
    const seedDate = new Date(seed.date);
    const group = [seed];
    used.add(i);
    for (let j = i + 1; j < transitionsInWindow.length; j++) {
      if (used.has(j)) continue;
      const cand = transitionsInWindow[j];
      const diffDays = Math.abs((new Date(cand.date) - seedDate) / (1000 * 60 * 60 * 24));
      if (diffDays <= TRANSITION_CLUSTER_DAYS) {
        group.push(cand);
        used.add(j);
      }
    }
    if (group.length >= 2) {
      clusters.push({
        windowStart: group[0].date,
        windowEnd: group[group.length - 1].date,
        members: group.map((g) => ({ memberId: g.memberId, displayName: g.displayName, date: g.date })),
      });
    }
  }

  const lordCounts = new Map();
  for (const lane of lanes) {
    const segsForCount = Array.isArray(lane.segments) ? lane.segments : [];
    for (const seg of segsForCount) {
      const key = seg.antarLord;
      lordCounts.set(key, (lordCounts.get(key) || 0) + 1);
    }
  }
  const dominantThemes = [...lordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lord]) => lord);

  const bullets = [];
  if (clusters.length > 0) {
    bullets.push({
      key: 'transitionCluster',
      params: { count: clusters.length, days: TRANSITION_CLUSTER_DAYS },
    });
  }
  if (dominantThemes.length > 0) {
    bullets.push({ key: 'dominantThemes', params: { lords: dominantThemes } });
  }
  const earliestTransition = lanes
    .map((l) => l.nextTransition)
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (earliestTransition) {
    bullets.push({
      key: 'nextTransition',
      params: {
        date: earliestTransition.date,
        fromMahaLord: earliestTransition.fromMahaLord,
        fromAntarLord: earliestTransition.fromAntarLord,
      },
    });
  }

  const headlineKey =
    lanes.length === 0
      ? 'empty'
      : clusters.length > 0
      ? 'clusterAhead'
      : 'steady';

  return {
    headlineKey,
    bullets,
    transitionClusters: clusters,
    dominantThemes,
  };
}

/**
 * Compute the family-dasha window payload for N members.
 * @param {{members: Array, windowStart: string, windowEnd: string}} input
 * @returns {{lanes: Array, overview: object, overviewRulesVersion: string, computedAt: string}}
 */
function computeFamilyDashaWindow(input) {
  const winStart = new Date(input.windowStart);
  const winEnd = new Date(input.windowEnd);
  if (Number.isNaN(winStart.getTime()) || Number.isNaN(winEnd.getTime()) || winStart >= winEnd) {
    throw new Error('Invalid window: windowStart must be before windowEnd');
  }
  const now = new Date();
  const lanes = [];
  for (const member of input.members || []) {
    if (
      !member ||
      !member.date ||
      !member.time ||
      member.lat === undefined ||
      member.lng === undefined ||
      member.timezone === undefined
    ) {
      lanes.push({
        memberId: member && member.id,
        displayName: member && member.displayName,
        segments: [],
        nextTransition: null,
        excludedReason: 'missing_birth_data',
      });
      continue;
    }
    try {
      const { segments, nextTransition } = computeMemberLane(member, winStart, winEnd, now);
      lanes.push({
        memberId: member.id,
        displayName: member.displayName,
        segments,
        nextTransition,
      });
    } catch (err) {
      lanes.push({
        memberId: member.id,
        displayName: member.displayName,
        segments: [],
        nextTransition: null,
        excludedReason: 'compute_failed',
        error: err && err.message,
      });
    }
  }

  return {
    lanes,
    overview: buildOverview(lanes, winStart, winEnd),
    overviewRulesVersion: '1.0',
    computedAt: new Date().toISOString(),
  };
}

module.exports = {
  computeFamilyDashaWindow,
  LORD_TONE,
  TRANSITION_CLUSTER_DAYS,
};
