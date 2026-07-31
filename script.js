const grid = document.getElementById('grid');
const launchBtn = document.getElementById('launchBtn');
const stopBtn = document.getElementById('stopBtn');
const urlsInput = document.getElementById('urlsInput');
const countInput = document.getElementById('countInput');
const proxyStats = document.getElementById('proxyStats');

const BACKEND_URL = 'https://hydraview-ultimate.onrender.com';
let activeSessions = []; 
let isSystemRunning = false; // للتحكم في الإيقاف الشامل

async function updateProxyCount() {
    proxyStats.textContent = '⏳ جاري الاتصال...';
    try {
        const res = await fetch(`${BACKEND_URL}/api/proxy-count`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        proxyStats.textContent = `البروكسيات: ${data.count}`;
    } catch (e) { 
        proxyStats.textContent = '⚠️ الخادم نائم (أعد التحديث)'; 
    }
}
updateProxyCount();

function extractYouTubeID(url) {
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(reg);
    return match ? match[1] : null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// وظيفة كل مربع (حلقة لا نهائية تتنقل بين الروابط)
async function startSquareLoop(cell, initialUrlIndex, lines) {
    let currentUrlIndex = initialUrlIndex;
    let squareActive = true;

    // ربط دالة الإيقاف بالمربع ليتمكن زر "إيقاف الكل" من إنهاء الحلقة
    cell.stopLoop = () => { squareActive = false; };

    while (squareActive && isSystemRunning) {
        const videoUrl = lines[currentUrlIndex % lines.length];
        const videoId = extractYouTubeID(videoUrl);

        if (!videoId) {
            currentUrlIndex++;
            continue;
        }

        cell.innerHTML = `
            <div class="status-text text-blue">🔄 طلب جديد</div>
            <div class="proxy-text">التواصل مع الخادم...</div>
        `;

        try {
            const sessionRes = await fetch(`${BACKEND_URL}/api/create-session?videoId=${videoId}`);
            const data = await sessionRes.json();
            
            // إذا كان الخادم يعالج الحد الأقصى للمتصفحات، انتظر في الطابور بصمت
            if (sessionRes.status === 429) {
                cell.innerHTML = `
                    <div class="status-text text-yellow">⏳ في الطابور</div>
                    <div class="proxy-text">الخادم مشغول الآن</div>
                `;
                await sleep(5000 + Math.random() * 5000); // انتظار 5 إلى 10 ثوانٍ قبل المحاولة
                continue;
            }
            
            if (!sessionRes.ok) throw new Error(data.error || 'فشل الاتصال');
            
            activeSessions.push(data.sessionId);

            // 🟢 النجاح! بدء العداد التنازلي للمشاهدة
            // العداد بين 60 و 90 ثانية عشوائياً لضمان احتساب يوتيوب للمشاهدة
            let timeLeft = 60 + Math.floor(Math.random() * 30); 
            
            while (timeLeft > 0 && squareActive && isSystemRunning) {
                cell.innerHTML = `
                    <div class="status-text text-green">✅ جاري المشاهدة</div>
                    <div class="timer">${timeLeft}</div>
                    <div class="proxy-text">${data.proxyInfo}</div>
                `;
                await sleep(1000);
                timeLeft--;
            }

            // بعد انتهاء العداد، نغلق المتصفح لنوفر الذاكرة للمربع التالي
            if (squareActive && isSystemRunning) {
                cell.innerHTML = `<div class="status-text text-yellow">⏹ جاري الإغلاق...</div>`;
                await fetch(`${BACKEND_URL}/api/stop-session?sessionId=${data.sessionId}`).catch(()=>{});
                activeSessions = activeSessions.filter(id => id !== data.sessionId);
                
                // الانتقال للرابط التالي في القائمة للمحاولة القادمة
                currentUrlIndex++; 
            }

        } catch (error) {
            // 🔴 فشل البروكسي: تخطي سريع والمحاولة مرة أخرى
            cell.innerHTML = `
                <div class="status-text text-red">❌ فشل البروكسي</div>
                <div class="proxy-text">جاري التخطي السريع...</div>
            `;
            await sleep(3000); // انتظار 3 ثوانٍ فقط ثم إعادة المحاولة لنفس الرابط ببروكسي جديد
        }
    }
}

launchBtn.addEventListener('click', async () => {
    const lines = urlsInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return alert('أدخل رابطاً واحداً على الأقل');
    
    // إزالة حد الـ 4 مربعات. الآن يمكنك فتح ما تشاء من المربعات في الواجهة
    const count = parseInt(countInput.value) || 1; 
    
    grid.innerHTML = '';
    activeSessions = [];
    isSystemRunning = true;
    
    launchBtn.disabled = true;

    // رسم المربعات وإطلاق الحلقات
    for (let i = 0; i < count; i++) {
        const cell = document.createElement('div');
        cell.className = 'video-cell';
        grid.appendChild(cell);
        
        // إطلاق الحلقة لكل مربع بشكل متزامن
        startSquareLoop(cell, i, lines);
    }
});

stopBtn.addEventListener('click', () => {
    isSystemRunning = false;
    
    // إيقاف جميع الحلقات الفعالة في المربعات
    const cells = document.querySelectorAll('.video-cell');
    cells.forEach(cell => {
        if(cell.stopLoop) cell.stopLoop();
    });

    // إرسال طلبات الإغلاق للخادم
    activeSessions.forEach(sessionId => {
        fetch(`${BACKEND_URL}/api/stop-session?sessionId=${sessionId}`).catch(() => {});
    });
    
    grid.innerHTML = '<div style="color: #f85149; padding: 20px;">تم إيقاف النظام وتفريغ الخادم.</div>';
    activeSessions = [];
    launchBtn.disabled = false;
});
