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
const MAX_SESSIONS = 2; // درع الحماية: أقصى عدد للمتصفحات النشطة لمنع انهيار الخادم

loadProxies();
setInterval(loadProxies, 30 * 60 * 1000);

app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

app.get('/api/create-session', async (req, res) => {
    // 1. فحص درع الحماية
    if (currentSessions >= MAX_SESSIONS) {
        return res.status(429).json({ error: 'الخادم ممتلئ حالياً، يرجى الانتظار قليلاً.' });
    }

    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'رابط الفيديو مطلوب' });

    const proxy = getBestProxy();
    if (!proxy) return res.status(500).json({ error: 'لا توجد بروكسيات متاحة' });

    const sessionId = Date.now().toString(36);
    currentSessions++; // تسجيل دخول متصفح جديد

    try {
        console.log(`[${sessionId}] جاري إطلاق الشبح باستخدام بروكسي ${proxy.ip}`);

        // 2. تشغيل المتصفح السحابي المصغر
        const browser = await puppeteer.launch({
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

        const page = await browser.newPage();

        // 3. وضعية الشبح: توفير الذاكرة عبر حجب الصور والتصاميم
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            // حجب كل شيء ما عدا السكريبتات والفيديو نفسه
            if (['image', 'stylesheet', 'font'].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 4. الذهاب للفيديو وتشغيله
        await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

        await page.evaluate(() => {
            const playBtn = document.querySelector('.ytp-play-button');
            if(playBtn) playBtn.click();
        });

        activeBrowsers[sessionId] = browser;

        // 5. تدمير المتصفح ذاتياً بعد دقيقتين لتفريغ الذاكرة
        setTimeout(async () => {
            if (activeBrowsers[sessionId]) {
                await activeBrowsers[sessionId].close();
                delete activeBrowsers[sessionId];
                currentSessions--;
                console.log(`[${sessionId}] تم إغلاق المتصفح وتفريغ الذاكرة`);
            }
        }, 120000);

        res.json({
            sessionId,
            proxyInfo: `${proxy.ip}:${proxy.port} (Ghost Mode)`,
            status: '✅ المشاهدة تعمل بوضعية الشبح'
        });

    } catch (e) {
        console.error(`[${sessionId}] خطأ:`, e);
        if (activeBrowsers[sessionId]) {
            await activeBrowsers[sessionId].close();
            delete activeBrowsers[sessionId];
        }
        currentSessions--;
        reportProxyResult(proxy.ip, proxy.port, false);
        res.status(502).json({ error: 'فشل تشغيل المتصفح، الـ IP قد يكون محظوراً' });
    }
});

app.get('/api/stop-session', async (req, res) => {
    const { sessionId } = req.query;
    if (activeBrowsers[sessionId]) {
        await activeBrowsers[sessionId].close();
        delete activeBrowsers[sessionId];
        currentSessions--;
        res.json({ status: 'تم الإيقاف بنجاح' });
    } else {
        res.json({ status: 'الجلسة غير موجودة' });
    }
});

app.listen(PORT, () => console.log(`الخادم يعمل بوضعية الشبح على المنفذ ${PORT}`));
