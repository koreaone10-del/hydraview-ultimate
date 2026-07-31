const grid = document.getElementById('grid');
const launchBtn = document.getElementById('launchBtn');
const stopBtn = document.getElementById('stopBtn');
const urlsInput = document.getElementById('urlsInput');
const countInput = document.getElementById('countInput');
const proxyStats = document.getElementById('proxyStats');

const BACKEND_URL = 'https://hydraview-ultimate.onrender.com';
let activeSessions = []; // لتخزين الجلسات النشطة لإيقافها لاحقاً

async function updateProxyCount() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/proxy-count`);
        const data = await res.json();
        proxyStats.textContent = `البروكسيات: ${data.count}`;
    } catch (e) { 
        proxyStats.textContent = 'البروكسيات: ?'; 
    }
}
updateProxyCount();

function extractYouTubeID(url) {
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(reg);
    return match ? match[1] : null;
}

launchBtn.addEventListener('click', async () => {
    const lines = urlsInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return alert('أدخل رابطاً واحداً على الأقل');
    
    const count = Math.min(parseInt(countInput.value) || 1, 20); // قللنا الحد الأقصى لحماية الخادم
    grid.innerHTML = '';
    activeSessions = [];
    
    launchBtn.disabled = true;
    launchBtn.textContent = '⏳ يتم تجهيز الخادم...';

    for (let i = 0; i < count; i++) {
        const videoUrl = lines[i % lines.length];
        const videoId = extractYouTubeID(videoUrl);
        
        if (!videoId) {
            alert('❌ لم يتم التعرف على الرابط: ' + videoUrl);
            continue;
        }

        try {
            const sessionRes = await fetch(`${BACKEND_URL}/api/create-session?videoId=${videoId}`);
            
            if (!sessionRes.ok) throw new Error('فشل تشغيل المتصفح');
            
            const data = await sessionRes.json();
            activeSessions.push(data.sessionId);

            // بناء بطاقة معلومات بدلاً من شاشة الفيديو
            const cell = document.createElement('div');
            cell.className = 'video-cell';
            cell.style.display = 'flex';
            cell.style.flexDirection = 'column';
            cell.style.justifyContent = 'center';
            cell.style.alignItems = 'center';
            cell.style.background = '#161b22';

            cell.innerHTML = `
                <div style="color: #4ade80; margin-bottom: 10px;">${data.status}</div>
                <div style="font-size: 12px; color: #8b949e;">البروكسي:</div>
                <div style="font-size: 14px; font-weight: bold; color: #fff;">${data.proxyInfo}</div>
                <div style="font-size: 10px; color: #8b949e; margin-top: 10px;">سيتم الإغلاق بعد 3 دقائق</div>
            `;

            grid.appendChild(cell);
            
        } catch (error) {
            console.error(error);
        }
    }
    
    launchBtn.disabled = false;
    launchBtn.textContent = '🚀 تشغيل';
});

stopBtn.addEventListener('click', () => {
    // إيقاف جميع المتصفحات على الخادم
    activeSessions.forEach(sessionId => {
        fetch(`${BACKEND_URL}/api/stop-session?sessionId=${sessionId}`);
    });
    grid.innerHTML = '<div style="color: #f85149; padding: 20px;">تم إرسال أمر الإيقاف للخادم.</div>';
    activeSessions = [];
});
