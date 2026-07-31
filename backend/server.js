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
// ⚠️ تحذير: 10 نوافذ تتطلب باقة مدفوعة (2GB RAM) في Render. في الباقة المجانية سينهار الخادم.
const MAX_SESSIONS = 10; 

loadProxies();
setInterval(loadProxies, 15 * 60 * 1000); 

app.get('/api/proxy-count', (req, res) => {
    res.json(getProxyCount());
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
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process' // لتقليل كشف الروبوت
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        activeBrowsers[sessionId] = browser;
        const page = await browser.newPage();

        // التعديل: نسمح بتحميل بعض الملفات لكي لا نكشف أننا "شبح" تماماً ليوتيوب
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font'].includes(req.resourceType())) req.abort(); // نمنع الصور والخطوط فقط لتوفير قليل من الـ RAM
            else req.continue(); // نسمح بـ CSS و JS ليقتنع يوتيوب
        });

        // تمويه بصمة المتصفح (Spoofing)
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            window.chrome = { runtime: {} }; // إقناع يوتيوب أنه متصفح كروم حقيقي
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // محاكاة بشرية لاحتساب المشاهدة
        await page.evaluate(async () => {
            const playBtn = document.querySelector('.ytp-play-button');
            if(playBtn) playBtn.click();
            
            // تمرير الشاشة (Scroll) بشكل عشوائي ليبدو طبيعياً
            setInterval(() => {
                window.scrollBy(0, Math.random() > 0.5 ? 100 : -50);
            }, 5000);
        });

        reportProxyResult(usedProxy.ip, usedProxy.port, true);

        setTimeout(async () => {
            if (activeBrowsers[sessionId]) {
                try { await activeBrowsers[sessionId].close(); } catch(e) {}
                delete activeBrowsers[sessionId];
                currentSessions = Math.max(0, currentSessions - 1);
            }
        }, 150000); // 2.5 دقيقة كحد أقصى

        res.json({
            sessionId,
            proxyInfo: `${usedProxy.ip}:${usedProxy.port}`,
            status: '✅ جاري المشاهدة'
        });

    } catch (e) {
        reportProxyResult(usedProxy.ip, usedProxy.port, false);
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
