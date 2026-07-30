const express = require('express');
const cookieParser = require('cookie-parser');
const { loadProxies, getBestProxy, reportProxyResult, getProxyCount } = require('./modules/ai-scorer');
const { createSession, getSession, deleteSession } = require('./modules/session-manager');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());

// تحميل البروكسيات عند التشغيل والجدولة
loadProxies();
setInterval(loadProxies, 30 * 60 * 1000); // كل 30 دقيقة

// نقطة عدد البروكسيات
app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

// إنشاء جلسة جديدة (تعيد sessionId ومعلومات البروكسي المستخدم)
app.get('/api/create-session', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });

    const proxy = getBestProxy();
    if (!proxy) return res.status(500).json({ error: 'No proxies available' });

    const sessionId = createSession(videoId, proxy);
    res.json({ sessionId, proxyInfo: `${proxy.ip}:${proxy.port} (AI)` });
});

// عرض صفحة embed للفيديو عبر البروكسي مع التخفي
app.get('/embed/:sessionId', async (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).send('Session expired');

    const videoUrl = `https://www.youtube.com/embed/${session.videoId}?autoplay=1&mute=1&controls=0&enablejsapi=1&modestbranding=1`;
    // هنا نطلب الصفحة عبر البروكسي المخزن في الجلسة ونعدلها لإضافة سكريبتات التخفي
    try {
        const fetch = require('node-fetch');
        const HttpsProxyAgent = require('https-proxy-agent');
        const HttpProxyAgent = require('http-proxy-agent');
        const agent = videoUrl.startsWith('https') 
            ? new HttpsProxyAgent(`http://${session.proxy.ip}:${session.proxy.port}`)
            : new HttpProxyAgent(`http://${session.proxy.ip}:${session.proxy.port}`);

        const response = await fetch(videoUrl, {
            agent,
            headers: {
                'User-Agent': session.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        let body = await response.text();
        // حقن سكريبت التخفي والتشغيل التلقائي
        const stealthScript = `
        <script>
        // إخفاء webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // محاكاة بشرية
        setInterval(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: Math.random()*400, clientY: Math.random()*300 })); }, 2000);
        // التشغيل التلقائي الإجباري
        document.addEventListener('DOMContentLoaded', function() {
            var v = document.querySelector('video');
            if(v) { v.muted = true; v.play(); }
        });
        </script>`;
        body = body.replace('</head>', `${stealthScript}</head>`);
        res.set('Content-Type', 'text/html');
        res.send(body);
    } catch(e) {
        // في حالة الفشل، سجل النتيجة وأعد المحاولة لاحقاً
        reportProxyResult(session.proxy.ip, session.proxy.port, false);
        res.status(502).send('فشل تحميل الفيديو عبر البروكسي');
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));