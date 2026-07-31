const grid = document.getElementById('grid');
const launchBtn = document.getElementById('launchBtn');
const stopBtn = document.getElementById('stopBtn');
const urlsInput = document.getElementById('urlsInput');
const countInput = document.getElementById('countInput');
const proxyStats = document.getElementById('proxyStats');

const BACKEND_URL = 'https://hydraview-ultimate.onrender.com';
let activeSessions = []; 
let isSystemRunning = false; 

async function updateProxyCount() {
    proxyStats.textContent = '⏳ جاري الاتصال...';
    try {
        const res = await fetch(`${BACKEND_URL}/api/proxy-count`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        // عرض البروكسيات العادية + البروكسيات المحفوظة (الممتازة)
        proxyStats.textContent = `البروكسيات: ${data.count} | المحفوظة الشغالة: ${data.premiumCount}`;
    } catch (e) { 
        proxyStats.textContent = '⚠️ الخادم نائم (أعد التحديث)'; 
    }
}
updateProxyCount();
setInterval(updateProxyCount, 15000); 

function extractYouTubeID(url) {
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(reg);
    return match ? match[1] : null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startSquareLoop(cell, initialUrlIndex, lines) {
    let currentUrlIndex = initialUrlIndex;
    let squareActive = true;

    cell.stopLoop = () => { squareActive = false; };

    while (squareActive && isSystemRunning) {
        const videoUrl = lines[currentUrlIndex % lines.length];
        const videoId = extractYouTubeID(videoUrl);

        if (!videoId) {
            currentUrlIndex++;
            continue;
        }

        cell.innerHTML = `
            <div class="status-text text-blue">🔄 طلب بديل</div>
            <div class="proxy-text">جلب بروكسي جديد...</div>
        `;

        try {
            const sessionRes = await fetch(`${BACKEND_URL}/api/create-session?videoId=${videoId}`);
            const data = await sessionRes.json();
            
            if (sessionRes.status === 429) {
                cell.innerHTML = `
                    <div class="status-text text-yellow">⏳ في الطابور</div>
                    <div class="proxy-text">الخادم مشغول</div>
                `;
                await sleep(5000 + Math.random() * 3000); 
                continue;
            }
            
            if (!sessionRes.ok) throw new Error(data.error);
            
            activeSessions.push(data.sessionId);

            // 🚀 الرفع للأعلى: بمجرد النجاح، ننقل المربع إلى أعلى الشاشة
            grid.prepend(cell);

            // عداد المشاهدة العشوائي (بين 60 و 120 ثانية لزيادة فرصة الاحتساب)
            let timeLeft = 60 + Math.floor(Math.random() * 60); 
            
            while (timeLeft > 0 && squareActive && isSystemRunning) {
                cell.innerHTML = `
                    <div class="status-text text-green">✅ جاري المشاهدة</div>
                    <div class="timer">${timeLeft}</div>
                    <div class="proxy-text">${data.proxyInfo}</div>
                `;
                await sleep(1000);
                timeLeft--;
            }

            if (squareActive && isSystemRunning) {
                cell.innerHTML = `<div class="status-text text-yellow">⏹ جاري الإغلاق...</div>`;
                await fetch(`${BACKEND_URL}/api/stop-session?sessionId=${data.sessionId}`).catch(()=>{});
                activeSessions = activeSessions.filter(id => id !== data.sessionId);
                currentUrlIndex++; 
            }

        } catch (error) {
            cell.innerHTML = `
                <div class="status-text text-red">❌ فشل الاتصال</div>
                <div class="proxy-text">تم حذفه، طلب بديل...</div>
            `;
            // إعادة المربع الفاشل للأسفل (اختياري، ليبرز الناجح أكثر)
            grid.appendChild(cell);
            await sleep(2000); 
        }
    }
}

launchBtn.addEventListener('click', async () => {
    const lines = urlsInput.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return alert('أدخل رابطاً واحداً على الأقل');
    
    const count = parseInt(countInput.value) || 1; 
    
    grid.innerHTML = '';
    activeSessions = [];
    isSystemRunning = true;
    launchBtn.disabled = true;

    for (let i = 0; i < count; i++) {
        const cell = document.createElement('div');
        cell.className = 'video-cell';
        grid.appendChild(cell);
        startSquareLoop(cell, i, lines);
    }
});

stopBtn.addEventListener('click', () => {
    isSystemRunning = false;
    const cells = document.querySelectorAll('.video-cell');
    cells.forEach(cell => { if(cell.stopLoop) cell.stopLoop(); });

    activeSessions.forEach(sessionId => {
        fetch(`${BACKEND_URL}/api/stop-session?sessionId=${sessionId}`).catch(() => {});
    });
    
    grid.innerHTML = '<div style="color: #f85149; padding: 20px;">تم إيقاف النظام وتفريغ الخادم.</div>';
    activeSessions = [];
    launchBtn.disabled = false;
});
