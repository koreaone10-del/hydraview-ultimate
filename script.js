const grid = document.getElementById('grid');
const launchBtn = document.getElementById('launchBtn');
const stopBtn = document.getElementById('stopBtn');
const urlsInput = document.getElementById('urlsInput');
const countInput = document.getElementById('countInput');
const proxyStats = document.getElementById('proxyStats');

// رابط الخادم الخاص بك
const BACKEND_URL = 'https://hydraview-ultimate.onrender.com';
let activeSessions = []; // لتخزين الجلسات النشطة لإيقافها لاحقاً

// تحديث عدد البروكسيات مع إظهار حالة الخادم
async function updateProxyCount() {
    proxyStats.textContent = '⏳ جاري الاتصال بالخادم...';
    try {
        const res = await fetch(`${BACKEND_URL}/api/proxy-count`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        proxyStats.textContent = `البروكسيات: ${data.count}`;
    } catch (e) { 
        proxyStats.textContent = '⚠️ الخادم نائم (أعد التحديث)'; 
    }
}
updateProxyCount();

// استخراج المعرف لدعم روابط يوتيوب العادية والفيديوهات القصيرة (Shorts)
function extractYouTubeID(url) {
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(reg);
    return match ? match[1] : null;
}

launchBtn.addEventListener('click', async () => {
    const lines = urlsInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    
    if (!lines.length) return alert('أدخل رابطاً واحداً على الأقل');
    
    const count = Math.min(parseInt(countInput.value) || 1, 4); // تحديد أقصى عدد مؤقتاً لحماية الخادم
    grid.innerHTML = '';
    activeSessions = [];
    
    // تعطيل الزر أثناء التجهيز
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
            // إرسال الطلب للخادم
            const sessionRes = await fetch(`${BACKEND_URL}/api/create-session?videoId=${videoId}`);
            const data = await sessionRes.json();
            
            // إذا كان هناك خطأ من الخادم (مثل امتلاء الذاكرة أو فشل البروكسي)
            if (!sessionRes.ok) {
                throw new Error(data.error || 'البروكسي ضعيف، حاول مجدداً');
            }
            
            // إضافة الجلسة لقائمة الإيقاف
            activeSessions.push(data.sessionId);

            // إنشاء بطاقة النجاح
            const cell = document.createElement('div');
            cell.className = 'video-cell';
            cell.style.display = 'flex';
            cell.style.flexDirection = 'column';
            cell.style.justifyContent = 'center';
            cell.style.alignItems = 'center';
            cell.style.background = '#161b22';

            cell.innerHTML = `
                <div style="color: #4ade80; margin-bottom: 10px;">${data.status}</div>
                <div style="font-size: 12px; color: #8b949e;">البروكسي المستخدم:</div>
                <div style="font-size: 14px; font-weight: bold; color: #fff;">${data.proxyInfo}</div>
                <div style="font-size: 10px; color: #8b949e; margin-top: 10px;">(يتم التشغيل كشبح في الخلفية)</div>
            `;

            grid.appendChild(cell);
            
        } catch (error) {
            // إنشاء بطاقة الفشل
            const cell = document.createElement('div');
            cell.className = 'video-cell';
            cell.style.display = 'flex';
            cell.style.flexDirection = 'column';
            cell.style.justifyContent = 'center';
            cell.style.alignItems = 'center';
            cell.style.background = '#300f0f';
            cell.style.border = '1px solid #f85149';
            
            cell.innerHTML = `
                <div style="color: #f85149; margin-bottom: 5px;">❌ خطأ في الاتصال</div>
                <div style="font-size: 11px; color: #c9d1d9; text-align: center; padding: 5px;">
                    ${error.message}
                </div>
            `;
            grid.appendChild(cell);
            console.error(error);
        }
    }
    
    // إعادة الزر لشكله الطبيعي
    launchBtn.disabled = false;
    launchBtn.textContent = '🚀 تشغيل';
});

stopBtn.addEventListener('click', () => {
    // إيقاف جميع المتصفحات النشطة على الخادم
    activeSessions.forEach(sessionId => {
        fetch(`${BACKEND_URL}/api/stop-session?sessionId=${sessionId}`).catch(e => console.error(e));
    });
    
    // مسح الشاشة وإظهار رسالة
    grid.innerHTML = '<div style="color: #f85149; padding: 20px;">تم إرسال أمر الإيقاف لتفريغ ذاكرة الخادم.</div>';
    activeSessions = [];
});
