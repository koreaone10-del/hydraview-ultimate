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
const MAX_SESSIONS = 2; // الحد الأقصى للمتصفحات لمنع انهيار الـ RAM

loadProxies();
setInterval(loadProxies, 30 * 60 * 1000);

app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

app.get('/api/create-session', async (req, res) => {
    if (currentSessions >= MAX_SESSIONS) {
        return res.status(429).json({ error: 'الخادم ممتلئ، انتظر قليلاً.' });
    }

    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'رابط الفيديو مطلوب' });

    const proxy = getBestProxy();
    if (!proxy) return res.status(500).json({ error: 'لا توجد بروكسيات' });

    const sessionId = Date.now().toString(36);
    currentSessions++; 

    let browser = null; // تعريف المتصفح خارج المحاولة لضمان الوصول إليه عند الخطأ

    try {
        console.log(`[${sessionId}] جاري التشغيل ببروكسي ${proxy.ip}`);

        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                `--proxy-server=http://${proxy.ip}:${proxy.port}`,
                '--mute-audio',
                '--disable-dev-shm-usage',
                '--no-sandbox'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        // ✅ حفظ المتصفح فوراً قبل محاولة فتح أي صفحة (ترقيع تسريب الذاكرة)
        activeBrowsers[sessionId] = browser;

        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // تقليل مدة الانتظار إلى 30 ثانية لتسريع اكتشاف البروكسيات الميتة
        await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        await page.evaluate(() => {
            const playBtn = document.querySelector('.ytp-play-button');
            if(playBtn) playBtn.click();
        });

        // تدمير المتصفح ذاتياً بعد دقيقتين
        setTimeout(async () => {
            if (activeBrowsers[sessionId]) {
                try { await activeBrowsers[sessionId].close(); } catch(e) {}
                delete activeBrowsers[sessionId];
                currentSessions = Math.max(0, currentSessions - 1);
                console.log(`[${sessionId}] تم تفريغ الذاكرة بنجاح`);
            }
        }, 120000);

        // الإبلاغ عن نجاح البروكسي
        reportProxyResult(proxy.ip, proxy.port, true);

        res.json({
            sessionId,
            proxyInfo: `${proxy.ip}:${proxy.port}`,
            status: '✅ المشاهدة تعمل'
        });

    } catch (e) {
        console.error(`[${sessionId}] فشل البروكسي:`, e.message);
        
        // ✅ إغلاق المتصفح بقوة وتفريغ الذاكرة حتى لو فشل البروكسي
        if (browser) {
            try { await browser.close(); } catch(err) {}
        }
        delete activeBrowsers[sessionId];
        currentSessions = Math.max(0, currentSessions - 1);
        
        // خفض تقييم البروكسي الفاشل
        reportProxyResult(proxy.ip, proxy.port, false);
        
        res.status(502).json({ error: 'البروكسي ضعيف أو محظور' });
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

app.listen(PORT, () => console.log(`الخادم يعمل على ${PORT}`));
