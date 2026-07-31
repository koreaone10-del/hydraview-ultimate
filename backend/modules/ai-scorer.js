const fse = require('fs-extra');
const path = require('path');
const { harvestAll } = require('./proxy-harvester');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.json');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

let proxies = [];
let scores = {};

async function loadProxies() {
    try {
        const freshProxies = await harvestAll();
        await fse.ensureDir(DATA_DIR);
        await fse.writeJson(PROXIES_FILE, freshProxies);
        proxies = freshProxies;
        console.log(`✅ تم تحديث البروكسيات: ${proxies.length} وكيل`);
    } catch(e) {
        console.error('فشل جلب البروكسيات:', e);
        if (await fse.pathExists(PROXIES_FILE)) {
            proxies = await fse.readJson(PROXIES_FILE);
        }
    }
    if (await fse.pathExists(SCORES_FILE)) {
        scores = await fse.readJson(SCORES_FILE);
    }
}

function getProxyCount() {
    return proxies.length;
}

function getBestProxy() {
    if (proxies.length === 0) return null;
    
    // Epsilon-Greedy: 20% استكشاف عشوائي
    if (Math.random() < 0.2) {
        return proxies[Math.floor(Math.random() * proxies.length)];
    }
    
    // تجميع البروكسيات ذات التقييم الأعلى واختيار واحد عشوائياً منها
    let topProxies = [];
    let maxScore = -1;

    for (const proxy of proxies) {
        const key = `${proxy.ip}:${proxy.port}`;
        const score = scores[key]?.score ?? 5;
        
        if (score > maxScore) {
            maxScore = score;
            topProxies = [proxy]; // بدء قائمة جديدة بأعلى تقييم
        } else if (score === maxScore) {
            topProxies.push(proxy); // إضافة البروكسي للقائمة إذا تساوى مع الأعلى
        }
    }

    // اختيار بروكسي عشوائي من قائمة الأفضل (لمنع تكرار نفس الـ IP)
    return topProxies[Math.floor(Math.random() * topProxies.length)];
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
    fse.writeJson(SCORES_FILE, scores).catch(()=>{});
}

module.exports = { loadProxies, getBestProxy, reportProxyResult, getProxyCount };
