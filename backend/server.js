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
const MAX_SESSIONS = 2; // أقصى عدد للمتصفحات لمنع انهيار الخادم

loadProxies();
setInterval(loadProxies, 30 * 60 * 1000); 

app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

app.get('/api/create-session', async (req, res) => {
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
    const MAX_RETRIES = 2; // محاولات متتالية لتخطي البروكسيات الميتة بصمت

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        usedProxy = getBestProxy();
        if (!usedProxy) break;

        try {
            console.log(`[${sessionId}] محاولة ${attempt + 1}: تجربة بروكسي ${usedProxy.ip}`);

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
            console.log(`[${sessionId}] فشل بروكسي ${usedProxy.ip}`);
            reportProxyResult(usedProxy.ip, usedProxy.port, false);
            
            if (browser) {
                try { await browser.close(); } catch(err) {}
            }
            delete activeBrowsers[sessionId];
        }
    }

    if (success) {
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
            status: '✅ المشاهدة تعمل بوضعية الشبح'
        });
    } else {
        currentSessions = Math.max(0, currentSessions - 1);
        res.status(502).json({ error: 'البروكسيات المتاحة محظورة أو ضعيفة' });
    }
});

app.get('/api/stop-session', async (req, res) => {
    const { sessionId } = req.query;
    if (activeBrowsers[sessionId]) {
        try { await activeBrowsers[sessionId].close(); } catch(e) {}
        delete activeBrowsers[sessionId];
        currentSessions = Math.max(0, currentSessions - 1);
        res.json({ status: 'تم الإيقاف بنجاح' });
    } else {
        res.json({ status: 'الجلسة غير موجودة' });
    }
});

app.listen(PORT, () => console.log(`الخادم يعمل بوضعية الشبح على المنفذ ${PORT}`));
