const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { loadProxies, getBestProxy, reportProxyResult, getProxyCount } = require('./modules/ai-scorer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json());

// حفظ المتصفحات النشطة لإغلاقها لاحقاً
const activeBrowsers = {}; 

loadProxies();
setInterval(loadProxies, 30 * 60 * 1000);

app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

// مسار جديد: إنشاء المتصفح المخفي على الخادم
app.get('/api/create-session', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });

    const proxy = getBestProxy();
    if (!proxy) return res.status(500).json({ error: 'لا يوجد بروكسيات متاحة' });

    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    try {
        // إطلاق المتصفح المخفي مع البروكسي المختار
        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                `--proxy-server=http://${proxy.ip}:${proxy.port}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // مهم جداً لمنع انهيار الخادم
                '--mute-audio' // كتم الصوت على الخادم
            ]
        });

        const page = await browser.newPage();
        
        // محاكاة متصفح عادي
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // التوجه إلى صفحة الفيديو
        await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // محاولة الضغط على زر التشغيل إن وجد
        await page.evaluate(() => {
            const playButton = document.querySelector('.ytp-play-button');
            if(playButton) playButton.click();
        });

        activeBrowsers[sessionId] = browser;

        // إغلاق المتصفح تلقائياً بعد 3 دقائق لتوفير موارد الخادم
        setTimeout(async () => {
            if (activeBrowsers[sessionId]) {
                await activeBrowsers[sessionId].close();
                delete activeBrowsers[sessionId];
            }
        }, 180000); 

        res.json({ 
            sessionId, 
            proxyInfo: `${proxy.ip}:${proxy.port} (AI)`,
            status: '✅ جاري المشاهدة على الخادم'
        });

    } catch (e) {
        reportProxyResult(proxy.ip, proxy.port, false);
        res.status(502).json({ error: 'فشل تشغيل المتصفح المخفي' });
    }
});

// مسار لإيقاف متصفح معين يدوياً
app.get('/api/stop-session', async (req, res) => {
    const { sessionId } = req.query;
    if (activeBrowsers[sessionId]) {
        await activeBrowsers[sessionId].close();
        delete activeBrowsers[sessionId];
        res.json({ status: 'تم الإيقاف' });
    } else {
        res.json({ status: 'الجلسة غير موجودة' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
