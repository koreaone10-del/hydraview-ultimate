const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const { loadProxies, getBestProxy, reportProxyResult, getProxyCount } = require('./modules/ai-scorer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

const activeBrowsers = {};
let currentSessions = 0;
const MAX_SESSIONS = 3; 

loadProxies();
// جلب بروكسيات جديدة كل 10 دقائق لتعويض البروكسيات المحذوفة
setInterval(loadProxies, 10 * 60 * 1000); 

app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

app.get('/api/create-session', async (req, res) => {
    if (currentSessions >= MAX_SESSIONS) {
        return res.status(429).json({ error: 'الخادم ممتلئ' });
    }

    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'رابط مطلوب' });

    const usedProxy = getBestProxy();
    if (!usedProxy) return res.status(500).json({ error: 'نفدت البروكسيات' });

    const sessionId = Date.now().toString(36);
    currentSessions++; 
    let browser = null;

    try {
        console.log(`[${sessionId}] تجربة: ${usedProxy.ip}:${usedProxy.port}`);

        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                `--proxy-server=http://${usedProxy.ip}:${usedProxy.port}`,
                '--mute-audio',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        activeBrowsers[sessionId] = browser;
        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // مهلة 20 ثانية فقط! إما أن يفتح أو يتم إعدامه
        await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });

        await page.evaluate(() => {
            const playBtn = document.querySelector('.ytp-play-button');
            if(playBtn) playBtn.click();
        });

        reportProxyResult(usedProxy.ip, usedProxy.port, true);

        // إغلاق ذاتي بعد دقيقتين للمشاهدة الناجحة
        setTimeout(async () => {
            if (activeBrowsers[sessionId]) {
                try { await activeBrowsers[sessionId].close(); } catch(e) {}
                delete activeBrowsers[sessionId];
                currentSessions = Math.max(0, currentSessions - 1);
            }
        }, 120000); 

        res.json({
            sessionId,
            proxyInfo: `${usedProxy.ip}:${usedProxy.port}`,
            status: '✅ جاري المشاهدة'
        });

    } catch (e) {
        // فشل في فتح الصفحة خلال 20 ثانية
        reportProxyResult(usedProxy.ip, usedProxy.port, false); // يتم حذفه هنا
        if (browser) {
            try { await browser.close(); } catch(err) {}
        }
        delete activeBrowsers[sessionId];
        currentSessions = Math.max(0, currentSessions - 1);
        
        res.status(502).json({ error: 'بروكسي ميت' });
    }
});

app.get('/api/stop-session', async (req, res) => {
    const { sessionId } = req.query;
    if (activeBrowsers[sessionId]) {
        try { await activeBrowsers[sessionId].close(); } catch(e) {}
        delete activeBrowsers[sessionId];
        currentSessions = Math.max(0, currentSessions - 1);
        res.json({ status: 'تم الإيقاف' });
    } else {
        res.json({ status: 'غير موجود' });
    }
});

app.listen(PORT, () => console.log(`الخادم يعمل على المنفذ ${PORT}`));
