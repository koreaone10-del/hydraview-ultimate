const grid = document.getElementById('grid');
const launchBtn = document.getElementById('launchBtn');
const stopBtn = document.getElementById('stopBtn');
const urlsInput = document.getElementById('urlsInput');
const countInput = document.getElementById('countInput');
const proxyStats = document.getElementById('proxyStats');

// رابط الخادم الخاص بك على Render
const BACKEND_URL = 'https://hydraview-ultimate.onrender.com';

async function updateProxyCount() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/proxy-count`);
        const data = await res.json();
        proxyStats.textContent = `البروكسيات: ${data.count}`;
    } catch { 
        proxyStats.textContent = 'البروكسيات: ?'; 
    }
}
updateProxyCount();

function extractYouTubeID(url) {
    // تم التعديل لدعم روابط الفيديوهات القصيرة (Shorts) بالإضافة للروابط العادية
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(reg);
    return match ? match[1] : null;
}

launchBtn.addEventListener('click', async () => {
    const lines = urlsInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    
    if (!lines.length) return alert('أدخل رابطاً واحداً على الأقل');
    
    const count = Math.min(parseInt(countInput.value) || 1, 200);
    grid.innerHTML = '';
    
    // تعطيل الزر مؤقتاً وتغيير النص لتأكيد الاستجابة أثناء التحميل
    launchBtn.disabled = true;
    launchBtn.textContent = '⏳ جاري التشغيل...';

    for (let i = 0; i < count; i++) {
        const videoUrl = lines[i % lines.length];
        const videoId = extractYouTubeID(videoUrl);
        
        // إذا لم يتعرف الكود على الرابط، سيتم تخطيه والانتقال للذي يليه
        if (!videoId) continue;

        try {
            // طلب جلسة جديدة من الخادم
            const sessionRes = await fetch(`${BACKEND_URL}/api/create-session?videoId=${videoId}`);
            
            // التأكد من أن الخادم رد بنجاح
            if (!sessionRes.ok) throw new Error('فشل الاتصال بالخادم');
            
            const { sessionId, proxyInfo } = await sessionRes.json();

            const cell = document.createElement('div');
            cell.className = 'video-cell';

            const iframe = document.createElement('iframe');
            iframe.src = `${BACKEND_URL}/embed/${sessionId}`;
            iframe.allow = 'autoplay; encrypted-media';
            iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups';

            const label = document.createElement('div');
            label.className = 'proxy-label';
            label.textContent = proxyInfo || 'بدون';

            cell.appendChild(iframe);
            cell.appendChild(label);
            grid.appendChild(cell);
            
        } catch (error) {
            console.error('حدث خطأ أثناء تحميل الفيديو:', error);
            break; // إيقاف الحلقة إذا كان الخادم لا يستجيب
        }
    }
    
    // إعادة الزر لحالته الطبيعية بعد الانتهاء من فتح النوافذ
    launchBtn.disabled = false;
    launchBtn.textContent = '🚀 تشغيل';
});

stopBtn.addEventListener('click', () => {
    grid.innerHTML = '';
});
