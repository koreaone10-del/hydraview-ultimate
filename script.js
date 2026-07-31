        try {
            const sessionRes = await fetch(`${BACKEND_URL}/api/create-session?videoId=${videoId}`);
            
            if (!sessionRes.ok) throw new Error('فشل تشغيل المتصفح');
            
            const data = await sessionRes.json();
            activeSessions.push(data.sessionId);

            // بطاقة النجاح
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
            `;
            grid.appendChild(cell);
            
        } catch (error) {
            // 👈 بطاقة الفشل الجديدة
            const cell = document.createElement('div');
            cell.className = 'video-cell';
            cell.style.display = 'flex';
            cell.style.flexDirection = 'column';
            cell.style.justifyContent = 'center';
            cell.style.alignItems = 'center';
            cell.style.background = '#300f0f';
            cell.style.border = '1px solid #f85149';
            cell.innerHTML = `
                <div style="color: #f85149; margin-bottom: 5px;">❌ خطأ في الخادم</div>
                <div style="font-size: 11px; color: #c9d1d9; text-align: center; padding: 5px;">
                    لم يتمكن Render من تشغيل Puppeteer.<br>
                    (الذاكرة ممتلئة أو ملفات النظام ناقصة)
                </div>
            `;
            grid.appendChild(cell);
            console.error(error);
        }
