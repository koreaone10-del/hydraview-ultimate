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
// الحد الأقصى الآمن لخادم Render المجاني هو 3 متصفحات في نفس اللحظة
const MAX_SESSIONS = 3; 

loadProxies();
setInterval(loadProxies, 30 * 60 * 1000); 

app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

app.get('/api/create-session', async (req, res) => {
    // نظام الطابور: إذا كان الخادم مشغولاً، نطلب من الواجهة الانتظار
    if (currentSessions >= MAX_SESSIONS) {
        return res.status(429).json({ error: 'الخادم ممتلئ، يرجى الانتظار قليلاً.' });
    }

    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'رابط الفيديو مطلوب' });

    const sessionId = Date.now().toString(36);
    currentSessions++; 

    let browser = null;
    let success = false;
    let usedProxy = null;
    const MAX_RETRIES = 2; 

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        usedProxy = getBestProxy();
        if (!usedProxy) break;

        try {
            console.log(`[${sessionId}] تجربة بروكسي ${usedProxy.ip}`);

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
                if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded', timeout: 25000 });

            await page.evaluate(() => {
                const playBtn = document.querySelector('.ytp-play-button');
                if(playBtn) playBtn.click();
            });

            success = true;
            reportProxyResult(usedProxy.ip, usedProxy.port, true);
            break; 

        } catch (e) {
            reportProxyResult(usedProxy.ip, usedProxy.port, false);
            if (browser) {
                try { await browser.close(); } catch(err) {}
            }
            delete activeBrowsers[sessionId];
        }
    }

    if (success) {
        // حماية إضافية: إغلاق المتصفح قسراً بعد 5 دقائق كحد أقصى إذا نسيته الواجهة
        setTimeout(async () => {
            if (activeBrowsers[sessionId]) {
                try { await activeBrowsers[sessionId].close(); } catch(e) {}
                delete activeBrowsers[sessionId];
                currentSessions = Math.max(0, currentSessions - 1);
            }
        }, 300000); 

        res.json({
            sessionId,
            proxyInfo: `${usedProxy.ip}:${usedProxy.port}`,
            status: '✅ المشاهدة تعمل'
        });
    } else {
        currentSessions = Math.max(0, currentSessions - 1);
        res.status(502).json({ error: 'البروكسيات محظورة' });
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
