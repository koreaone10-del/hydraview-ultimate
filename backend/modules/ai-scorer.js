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
        let freshProxies = await harvestAll();
        
        if (freshProxies.length > 3000) {
            freshProxies = freshProxies.sort(() => 0.5 - Math.random()).slice(0, 3000);
        }

        await fse.ensureDir(DATA_DIR);
        await fse.writeJson(PROXIES_FILE, freshProxies);
        proxies = freshProxies;
        console.log(`✅ تم تحديث البروكسيات بنجاح (العدد الفعلي المحفوظ: ${proxies.length})`);
    } catch(e) {
        if (await fse.pathExists(PROXIES_FILE)) {
            proxies = await fse.readJson(PROXIES_FILE);
        }
    }
    if (await fse.pathExists(SCORES_FILE)) {
        scores = await fse.readJson(SCORES_FILE);
    }
}

function getProxyCount() { return proxies.length; }

function getBestProxy() {
    if (proxies.length === 0) return null;
    if (Math.random() < 0.2) return proxies[Math.floor(Math.random() * proxies.length)];
    
    let topProxies = [];
    let maxScore = -1;

    for (const proxy of proxies) {
        const key = `${proxy.ip}:${proxy.port}`;
        const score = scores[key]?.score ?? 5;
        if (score > maxScore) { maxScore = score; topProxies = [proxy]; }
        else if (score === maxScore) { topProxies.push(proxy); }
    }
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
