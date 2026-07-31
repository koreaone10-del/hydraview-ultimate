const fse = require('fs-extra');
const path = require('path');
const { harvestAll } = require('./proxy-harvester');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.json');

// مصفوفة البروكسيات فقط (تم حذف متغيرات التقييم القديمة)
let proxies = [];

async function loadProxies() {
    try {
        let freshProxies = await harvestAll();
        
        // درع الذاكرة: حماية الخادم بالاكتفاء بأحدث 3000 بروكسي
        if (freshProxies.length > 3000) {
            freshProxies = freshProxies.sort(() => 0.5 - Math.random()).slice(0, 3000);
        }

        await fse.ensureDir(DATA_DIR);
        await fse.writeJson(PROXIES_FILE, freshProxies);
        proxies = freshProxies;
        console.log(`✅ تم تحديث البروكسيات (العدد المتاح حالياً: ${proxies.length})`);
    } catch(e) {
        console.error('⚠️ خطأ في جلب البروكسيات:', e.message);
        // في حال فشل الجلب، حاول استرجاع آخر نسخة محفوظة
        if (await fse.pathExists(PROXIES_FILE)) {
            proxies = await fse.readJson(PROXIES_FILE);
            console.log(`♻️ تم تحميل ${proxies.length} بروكسي من النسخة الاحتياطية`);
        }
    }
}

function getProxyCount() { 
    return proxies.length; 
}

function getBestProxy() {
    if (proxies.length === 0) return null;
    
    // سحب بروكسي عشوائي من القائمة المتبقية (لتجنب استخدام نفس البروكسي في نفس اللحظة)
    return proxies[Math.floor(Math.random() * proxies.length)];
}

function reportProxyResult(ip, port, success) {
    if (!success) {
        // 🔴 سياسة الاستبعاد الفوري: يتم حذف البروكسي من الذاكرة نهائياً
        const oldLength = proxies.length;
        proxies = proxies.filter(p => p.ip !== ip || p.port !== port);
        
        if (proxies.length < oldLength) {
            console.log(`🗑️ تم حذف البروكسي الميت: ${ip}:${port} | المتبقي: ${proxies.length}`);
        }
    } else {
        // 🟢 إذا نجح في المشاهدة، نتركه في القائمة ليعاد استخدامه لاحقاً
        console.log(`⭐ بروكسي ممتاز: ${ip}:${port}`);
    }
}

module.exports = { loadProxies, getBestProxy, reportProxyResult, getProxyCount };
