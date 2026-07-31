const fse = require('fs-extra');
const path = require('path');
const { harvestAll } = require('./proxy-harvester');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.json');

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
        console.log(`✅ تم تحديث البروكسيات (العدد: ${proxies.length})`);
    } catch(e) {
        if (await fse.pathExists(PROXIES_FILE)) {
            proxies = await fse.readJson(PROXIES_FILE);
        }
    }
}

function getProxyCount() { return proxies.length; }

function getBestProxy() {
    if (proxies.length === 0) return null;
    
    // سحب بروكسي عشوائي من القائمة المتبقية
    return proxies[Math.floor(Math.random() * proxies.length)];
}

function reportProxyResult(ip, port, success) {
    if (!success) {
        // 🔴 سياسة الاستبعاد الفوري: إذا فشل، يتم حذفه من القائمة نهائياً
        proxies = proxies.filter(p => p.ip !== ip || p.port !== port);
        console.log(`🗑️ تم حذف البروكسي الميت: ${ip}:${port} | المتبقي: ${proxies.length}`);
    } else {
        // 🟢 إذا نجح، نتركه في القائمة ليعاد استخدامه لاحقاً
        console.log(`⭐ بروكسي ممتاز: ${ip}:${port}`);
    }
}

module.exports = { loadProxies, getBestProxy, reportProxyResult, getProxyCount };
