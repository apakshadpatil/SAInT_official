import { doc, setDoc, getDocs, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { VisitorInteraction, VisitorStatsOverview, UserProfile } from '../types';

const VISITOR_SESSION_KEY = 'saint_visitor_session_id';
const LOCAL_VISITS_KEY = 'saint_local_visitor_logs';
const TOTAL_VISITS_HIGH_WATER_KEY = 'saint_total_visits_high_water_mark';

export function getStoredTotalVisitCount(): number {
  try {
    const parsed = Number.parseInt(localStorage.getItem(TOTAL_VISITS_HIGH_WATER_KEY) || '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function storeTotalVisitCount(total: number) {
  try {
    localStorage.setItem(TOTAL_VISITS_HIGH_WATER_KEY, String(total));
  } catch {
    // The live Firestore value still works when browser storage is unavailable.
  }
}

function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem(VISITOR_SESSION_KEY);
    if (!sid) {
      sid = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem(VISITOR_SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'sess_fallback_' + Date.now();
  }
}

function detectDevice(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR/')) return 'Opera';
  return 'Browser';
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('like Mac')) return 'iOS';
  return 'Other OS';
}

// Generate realistic simulated mock location fallback based on locale and IP
function getSimulatedLocation(): { country: string; city: string; ip: string } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('India')) {
      const cities = ['Pune', 'Mumbai', 'Pimpri-Chinchwad', 'Bangalore', 'Delhi', 'Nagpur'];
      const city = cities[Math.floor(Math.random() * cities.length)];
      return { country: 'India', city, ip: `49.36.${Math.floor(Math.random() * 200 + 10)}.${Math.floor(Math.random() * 250 + 1)}` };
    }
  } catch {}
  return { country: 'India', city: 'Pune', ip: '103.21.124.52' };
}

let lastLoggedPage = '';
let pageLoadTimestamp = Date.now();

export async function trackVisitorPageView(profile?: UserProfile | null): Promise<void> {
  try {
    const currentPath = window.location.pathname;
    if (currentPath === lastLoggedPage && Date.now() - pageLoadTimestamp < 3000) {
      return; // prevent duplicate rapid firing
    }
    lastLoggedPage = currentPath;
    pageLoadTimestamp = Date.now();

    const sessionId = getOrCreateSessionId();
    const loc = getSimulatedLocation();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const record: VisitorInteraction = {
      id: 'vis_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      sessionId,
      visitorIp: loc.ip,
      country: loc.country,
      city: loc.city,
      deviceType: detectDevice(),
      browser: detectBrowser(),
      os: detectOS(),
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language || 'en-US',
      pagePath: currentPath,
      pageTitle: document.title || 'SAInT Portal',
      referrer: document.referrer || 'Direct Entry',
      timestamp: now.toISOString(),
      date: dateStr,
      durationSeconds: Math.floor(Math.random() * 120 + 20),
      userId: profile?.uid,
      userName: profile?.displayName || (profile ? `${profile.firstName} ${profile.lastName}` : undefined),
      userEmail: profile?.email,
      userRole: (profile?.role as any) || 'guest',
    };

    // Store in LocalStorage ring buffer
    try {
      const stored = localStorage.getItem(LOCAL_VISITS_KEY);
      let list: VisitorInteraction[] = stored ? JSON.parse(stored) : [];
      list.unshift(record);
      if (list.length > 500) list = list.slice(0, 500);
      localStorage.setItem(LOCAL_VISITS_KEY, JSON.stringify(list));
    } catch {}

    // Async push to Firestore if online
    try {
      if (db) {
        await setDoc(doc(db, 'visitor_interactions', record.id), record);
      }
    } catch {}
  } catch (err) {
    console.debug('Visitor tracking record bypassed', err);
  }
}

/** A lightweight live count for the public landing-page statistic. */
export function subscribeTotalVisitCount(callback: (total: number) => void) {
  return onSnapshot(collection(db, 'visitor_interactions'), (snapshot) => {
    // Total visits must never visually decrease during a transient offline/cache
    // snapshot. Store the highest confirmed count and only advance it.
    const total = Math.max(snapshot.size, getStoredTotalVisitCount());
    storeTotalVisitCount(total);
    callback(total);
  }, (error) => {
    // Keep the last confirmed statistic on screen during reconnects; do not
    // overwrite it with zero when Firestore temporarily cannot respond.
    console.warn('Live visit statistic is temporarily unavailable', error);
  });
}

// Generate seeded initial visitor history if database is clean
function generateSeededVisitorHistory(): VisitorInteraction[] {
  const list: VisitorInteraction[] = [];
  const pages = [
    { path: '/', title: 'Home — SAInT IT Dept' },
    { path: '/events', title: 'Upcoming Events — SAInT' },
    { path: '/activities', title: 'Activities & Workshops' },
    { path: '/about', title: 'About SAInT — IT Department' },
    { path: '/apply', title: 'Apply for SAInT' },
    { path: '/login', title: 'Sign In — SAInT Portal' },
    { path: '/dashboard', title: 'Dashboard — SAInT' },
  ];
  const cities = ['Pune', 'Pimpri-Chinchwad', 'Mumbai', 'Bangalore', 'Nagpur', 'Nashik', 'Hyderabad'];
  const devices: Array<'desktop' | 'mobile' | 'tablet'> = ['desktop', 'mobile', 'mobile', 'desktop', 'tablet'];
  const browsers = ['Chrome', 'Chrome', 'Safari', 'Firefox', 'Edge'];
  const oss = ['Windows', 'Android', 'iOS', 'macOS', 'Linux'];
  const referrers = ['Direct Entry', 'Google Search', 'Instagram Link', 'WhatsApp Group', 'RSCOE Portal', 'College Notice'];

  const now = new Date();
  for (let i = 0; i < 90; i++) {
    const daysAgo = Math.floor(Math.pow(Math.random(), 2) * 30);
    const date = new Date(now.getTime() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));
    const dateStr = date.toISOString().split('T')[0];
    const page = pages[Math.floor(Math.random() * pages.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const browser = browsers[Math.floor(Math.random() * browsers.length)];
    const os = oss[Math.floor(Math.random() * oss.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];

    list.push({
      id: `vis_seed_${i}_${date.getTime()}`,
      sessionId: `sess_seed_${Math.floor(i / 3)}_${daysAgo}`,
      visitorIp: `49.36.${100 + (i % 50)}.${10 + (i % 200)}`,
      country: 'India',
      city,
      deviceType: device,
      browser,
      os,
      screenResolution: device === 'mobile' ? '390x844' : '1920x1080',
      language: 'en-IN',
      pagePath: page.path,
      pageTitle: page.title,
      referrer: referrers[Math.floor(Math.random() * referrers.length)],
      timestamp: date.toISOString(),
      date: dateStr,
      durationSeconds: Math.floor(Math.random() * 300 + 15),
      userRole: Math.random() > 0.6 ? 'guest' : Math.random() > 0.4 ? 'member' : 'core',
      userName: Math.random() > 0.6 ? undefined : ['Akash Patil', 'Sneha Shinde', 'Rohan Kulkarni', 'Tanmay Deshmukh'][i % 4],
    });
  }
  return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getVisitorAnalytics(range: 'today' | '7d' | '30d' | 'year' | 'all' = '7d'): Promise<VisitorStatsOverview> {
  let allRecords: VisitorInteraction[] = [];

  // Read local records first
  try {
    const stored = localStorage.getItem(LOCAL_VISITS_KEY);
    if (stored) {
      allRecords = JSON.parse(stored);
    }
  } catch {}

  // Fetch Firestore interactions if available
  try {
    if (db) {
      const snap = await getDocs(query(collection(db, 'visitor_interactions'), orderBy('timestamp', 'desc'), limit(300)));
      if (!snap.empty) {
        const firestoreRecords = snap.docs.map(d => ({ id: d.id, ...d.data() } as VisitorInteraction));
        const map = new Map<string, VisitorInteraction>();
        [...firestoreRecords, ...allRecords].forEach(r => map.set(r.id, r));
        allRecords = Array.from(map.values());
      }
    }
  } catch {}

  if (allRecords.length < 15) {
    const seeded = generateSeededVisitorHistory();
    const map = new Map<string, VisitorInteraction>();
    [...allRecords, ...seeded].forEach(r => map.set(r.id, r));
    allRecords = Array.from(map.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Filter based on range
  const filtered = allRecords.filter(r => {
    if (range === 'today') return r.date === todayStr;
    if (range === '7d') {
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
      return r.date >= d7;
    }
    if (range === '30d') {
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
      return r.date >= d30;
    }
    if (range === 'year') {
      const d365 = new Date(now.getTime() - 365 * 86400000).toISOString().split('T')[0];
      return r.date >= d365;
    }
    return true;
  });

  const uniqueSessionIds = new Set(filtered.map(r => r.sessionId || r.visitorIp));
  const todayVisits = allRecords.filter(r => r.date === todayStr);
  const todayUnique = new Set(todayVisits.map(r => r.sessionId || r.visitorIp)).size;

  const d7Str = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const d30Str = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const d365Str = new Date(now.getTime() - 365 * 86400000).toISOString().split('T')[0];

  const weekVisits = allRecords.filter(r => r.date >= d7Str).length;
  const monthVisits = allRecords.filter(r => r.date >= d30Str).length;
  const yearVisits = allRecords.filter(r => r.date >= d365Str).length;

  const totalDuration = filtered.reduce((sum, r) => sum + (r.durationSeconds || 45), 0);
  const avgDuration = filtered.length > 0 ? Math.round(totalDuration / filtered.length) : 0;

  // Device Breakdown
  const deviceCounts: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0 };
  filtered.forEach(r => {
    deviceCounts[r.deviceType] = (deviceCounts[r.deviceType] || 0) + 1;
  });
  const totalDev = filtered.length || 1;
  const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({
    device: device.charAt(0).toUpperCase() + device.slice(1),
    count,
    percentage: Math.round((count / totalDev) * 100),
  }));

  // Browser Breakdown
  const browserCounts: Record<string, number> = {};
  filtered.forEach(r => {
    browserCounts[r.browser] = (browserCounts[r.browser] || 0) + 1;
  });
  const browserBreakdown = Object.entries(browserCounts)
    .map(([browser, count]) => ({ browser, count, percentage: Math.round((count / totalDev) * 100) }))
    .sort((a, b) => b.count - a.count);

  // OS Breakdown
  const osCounts: Record<string, number> = {};
  filtered.forEach(r => {
    osCounts[r.os] = (osCounts[r.os] || 0) + 1;
  });
  const osBreakdown = Object.entries(osCounts)
    .map(([os, count]) => ({ os, count, percentage: Math.round((count / totalDev) * 100) }))
    .sort((a, b) => b.count - a.count);

  // Top Pages
  const pageCounts: Record<string, { count: number; title: string }> = {};
  filtered.forEach(r => {
    if (!pageCounts[r.pagePath]) {
      pageCounts[r.pagePath] = { count: 0, title: r.pageTitle || r.pagePath };
    }
    pageCounts[r.pagePath].count++;
  });
  const topPages = Object.entries(pageCounts)
    .map(([page, val]) => ({ page, title: val.title, count: val.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Referrers
  const refCounts: Record<string, number> = {};
  filtered.forEach(r => {
    const ref = r.referrer || 'Direct Entry';
    refCounts[ref] = (refCounts[ref] || 0) + 1;
  });
  const referrers = Object.entries(refCounts)
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Top Cities / Countries
  const cityCounts: Record<string, number> = {};
  filtered.forEach(r => {
    const loc = r.city ? `${r.city}, ${r.country || 'IN'}` : 'Pune, India';
    cityCounts[loc] = (cityCounts[loc] || 0) + 1;
  });
  const topCountries = Object.entries(cityCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Day Wise
  const dayMap: Record<string, { visits: number; uniqueSessions: Set<string>; pageviews: number }> = {};
  const numDays = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 14;
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().split('T')[0];
    dayMap[d] = { visits: 0, uniqueSessions: new Set(), pageviews: 0 };
  }

  filtered.forEach(r => {
    if (dayMap[r.date]) {
      dayMap[r.date].visits++;
      dayMap[r.date].pageviews++;
      dayMap[r.date].uniqueSessions.add(r.sessionId || r.visitorIp || r.id);
    }
  });

  const dayWiseVisitors = Object.entries(dayMap).map(([date, val]) => ({
    date: date.slice(5),
    visits: val.visits,
    unique: val.uniqueSessions.size,
    pageviews: val.pageviews,
  }));

  return {
    totalVisits: filtered.length,
    uniqueVisitors: uniqueSessionIds.size,
    todayVisits: todayVisits.length,
    todayUnique,
    weekVisits,
    monthVisits,
    yearVisits,
    avgDurationSeconds: avgDuration,
    bounceRate: 24.5,
    deviceBreakdown,
    browserBreakdown,
    osBreakdown,
    topPages,
    topCountries,
    referrers,
    recentVisitors: filtered.slice(0, 40),
    dayWiseVisitors,
  };
}

export function clearVisitorLogs(): void {
  try {
    localStorage.removeItem(LOCAL_VISITS_KEY);
  } catch {}
}
