const axios = require('axios');
const pMap = require('p-map');

// قائمة ضخمة لأهم المصادر المحدثة باستمرار (APIs و GitHub Repositories)
const rawSources = [
    // APIs سريعة
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks4&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=10000&country=all&ssl=all&anonymity=all',
    'https://www.proxyscan.io/download?type=http',
    
    // مستودعات GitHub المحدثة يومياً أو كل ساعة
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/http.txt',
    'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS.txt',
    'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
    'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt',
    'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
    'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks4/data.txt',
    'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
    'https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/http.txt',
    'https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/https.txt',
    'https://raw.githubusercontent.com/ALIILAPRO/Proxy/main/http.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/B4RC0DE-TM/proxy-list/main/HTTP.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt',
    'https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt',
    'https://raw.githubusercontent.com/MuRongPIG/Proxy-Master/main/http.txt'
];

async function harvestAll() {
    let all = [];
    console.log(`⏳ بدأ جلب البروكسيات من ${rawSources.length} مصدر...`);

    // جلب البيانات من 15 مصدر في نفس الوقت لتسريع العملية
    await pMap(rawSources, async (url) => {
        try {
            const { data } = await axios.get(url, { timeout: 12000 }); // مهلة 12 ثانية لكل مصدر
            
            // استخدام تعبير نمطي (Regex) قوي جداً لاستخراج أي IP و Port من النصوص بذكاء
            const regex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{1,5})/g;
            let match;
            
            while ((match = regex.exec(data)) !== null) {
                // فلترة مبدئية للتأكد من أن البورت منطقي
                const port = parseInt(match[2]);
                if (port > 0 && port <= 65535) {
                    all.push({ ip: match[1], port: port, protocol: 'http' });
                }
            }
        } catch (e) {
            // تجاهل المصادر المعطلة بصمت حتى لا تتوقف العملية بأكملها
        }
    }, { concurrency: 15 });

    // إزالة البروكسيات المكررة
    const unique = Array.from(new Map(all.map(p => [`${p.ip}:${p.port}`, p])).values());
    
    console.log(`✅ انتهى الفحص: تم العثور على ${unique.length} بروكسي فريد.`);
    return unique;
}

module.exports = { harvestAll };
