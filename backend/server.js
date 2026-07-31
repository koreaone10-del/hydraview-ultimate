const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { loadProxies, getBestProxy, reportProxyResult, getProxyCount } = require('./modules/ai-scorer');
const { createSession, getSession, deleteSession } = require('./modules/session-manager');
const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل CORS للسماح للموقع الأمامي بالاتصال
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// تحميل البروكسيات عند التشغيل وجدولتها كل 30 دقيقة
loadProxies();
setInterval(loadProxies, 30 * 60 * 1000);

// نقطة إرجاع عدد البروكسيات
app.get('/api/proxy-count', (req, res) => {
    res.json({ count: getProxyCount() });
});

// إنشاء جلسة جديدة
app.get('/api/create-session', async (req, res) => {
    const videoId = req.query.videoId;
    if (!videoId) return res.status(400).json({ error: 'videoId required' });

    const proxy = getBestProxy();
    if (!proxy) return res.status(500).json({ error: 'No proxies available' });

    const sessionId = createSession(videoId, proxy);
    res.json({ sessionId, proxyInfo: `${proxy.ip}:${proxy.port} (AI)` });
});

// عرض صفحة الفيديو عبر البروكسي مع التخفي
app.get('/embed/:sessionId', async (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).send('Session expired');

    const videoUrl = `https://www.youtube.com/embed/${session.videoId}?autoplay=1&mute=1&controls=0&enablejsapi=1&modestbranding=1`;
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
        // حقن سكريبت التخفي
        const stealthScript = `
        <script>
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        setInterval(() => { window.dispatchEvent(new MouseEvent('mousemove', { clientX: Math.random()*400, clientY: Math.random()*300 })); }, 2000);
        document.addEventListener('DOMContentLoaded', function() {
            var v = document.querySelector('video');
            if(v) { v.muted = true; v.play(); }
        });
        </script>`;
        body = body.replace('</head>', `${stealthScript}</head>`);
        res.set('Content-Type', 'text/html');
        res.send(body);
    } catch(e) {
        reportProxyResult(session.proxy.ip, session.proxy.port, false);
        res.status(502).send('فشل تحميل الفيديو عبر البروكسي');
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
