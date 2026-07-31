const fse = require('fs-extra');
const path = require('path');
const { harvestAll } = require('./proxy-harvester');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROXIES_FILE = path.join(DATA_DIR, 'proxies.json');
const PREMIUM_PROXIES_FILE = path.join(DATA_DIR, 'premium_proxies.json'); // الخزنة الجديدة

let proxies = [];
let premiumProxies = []; // البروكسيات المجربة والناجحة

async function loadProxies() {
    try {
        // تحميل الخزنة الممتازة أولاً إن وجدت
        if (await fse.pathExists(PREMIUM_PROXIES_FILE)) {
            premiumProxies = await fse.readJson(PREMIUM_PROXIES_FILE);
        }

        let freshProxies = await harvestAll();
        if (freshProxies.length > 3000) {
            freshProxies = freshProxies.sort(() => 0.5 - Math.random()).slice(0, 3000);
        }

        await fse.ensureDir(DATA_DIR);
        await fse.writeJson(PROXIES_FILE, freshProxies);
        proxies = freshProxies;
        console.log(`✅ تم تحديث البروكسيات (العادية: ${proxies.length} | المحفوظة الشغالة: ${premiumProxies.length})`);
    } catch(e) {
        if (await fse.pathExists(PROXIES_FILE)) {
            proxies = await fse.readJson(PROXIES_FILE);
        }
    }
}

function getProxyCount() { 
    return { count: proxies.length, premiumCount: premiumProxies.length }; 
}

function getBestProxy() {
    // الأولوية القصوى: استخدام بروكسي ناجح محفوظ سابقاً (بنسبة 70% من الوقت)
    if (premiumProxies.length > 0 && Math.random() < 0.7) {
        return premiumProxies[Math.floor(Math.random() * premiumProxies.length)];
    }
    
    // إذا لم نستخدم المحفوظ، نأخذ واحداً عشوائياً من الجدد للتجربة
    if (proxies.length === 0) return null;
    return proxies[Math.floor(Math.random() * proxies.length)];
}

async function reportProxyResult(ip, port, success) {
    const proxyStr = `${ip}:${port}`;
    
    if (!success) {
        // سياسة الإعدام: الحذف من القائمتين
        proxies = proxies.filter(p => p.ip !== ip || p.port !== port);
        const oldPremiumLength = premiumProxies.length;
        premiumProxies = premiumProxies.filter(p => p.ip !== ip || p.port !== port);
        
        // تحديث ملف المحفوظات إذا تم حذف واحد منه
        if (premiumProxies.length < oldPremiumLength) {
            await fse.writeJson(PREMIUM_PROXIES_FILE, premiumProxies).catch(()=>{});
        }
    } else {
        // 🟢 نجاح! إضافة البروكسي إلى قائمة المحفوظات الشغالة إذا لم يكن موجوداً
        const exists = premiumProxies.find(p => p.ip === ip && p.port === port);
        if (!exists) {
            premiumProxies.push({ ip, port, protocol: 'http' });
            await fse.writeJson(PREMIUM_PROXIES_FILE, premiumProxies).catch(()=>{});
            console.log(`⭐ تم حفظ بروكسي ممتاز للعمليات القادمة: ${ip}:${port}`);
        }
    }
}

module.exports = { loadProxies, getBestProxy, reportProxyResult, getProxyCount };
