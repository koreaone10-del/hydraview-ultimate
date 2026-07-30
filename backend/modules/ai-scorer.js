const fse = require('fs-extra');
const path = require('path');
const { harvestAll } = require('./proxy-harvester');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

let proxies = [];
let scores = {};

async function loadProxies() {
    // جلب البروكسيات من جميع المصادر وحفظها
    try {
        const freshProxies = await harvestAll();
        await fse.ensureDir(DATA_DIR);
        await fse.writeJson(PROXIES_FILE, freshProxies);
        proxies = freshProxies;
        console.log(`✅ تم تحديث البروكسيات: ${proxies.length} وكيل`);
    } catch(e) {
        console.error('فشل جلب البروكسيات:', e);
        // تحميل من الملف إن وجد
        if (await fse.pathExists(PROXIES_FILE)) {
            proxies = await fse.readJson(PROXIES_FILE);
        }
    }
    // تحميل السجلات
    if (await fse.pathExists(SCORES_FILE)) {
        scores = await fse.readJson(SCORES_FILE);
    }
}

function getProxyCount() {
    return proxies.length;
}

function getBestProxy() {
    if (proxies.length === 0) return null;
    // Epsilon-Greedy: 80% استغلال، 20% استكشاف
    if (Math.random() < 0.2) {
        return proxies[Math.floor(Math.random() * proxies.length)];
    }
    // اختر الأعلى نقاطاً (إذا لم توجد نقاط، تُعتبر 5)
    return proxies.reduce((a, b) => {
        const aKey = `${a.ip}:${a.port}`;
        const bKey = `${b.ip}:${b.port}`;
        const aScore = scores[aKey]?.score ?? 5;
        const bScore = scores[bKey]?.score ?? 5;
        return aScore > bScore ? a : b;
    });
}

function reportProxyResult(ip, port, success) {
    const key = `${ip}:${port}`;
    if (!scores[key]) scores[key] = { success: 0, fail: 0, score: 5 };
    if (success) {
        scores[key].success++;
        scores[key].score = Math.min(10, scores[key].score + 0.5);
    } else {
        scores[key].fail++;
        scores[key].score = Math.max(0, scores[key].score - 1);
    }
    // حفظ دوري (يمكن تحسينه)
    fse.writeJson(SCORES_FILE, scores).catch(()=>{});
}

module.exports = { loadProxies, getBestProxy, reportProxyResult, getProxyCount };