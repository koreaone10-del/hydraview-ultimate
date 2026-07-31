const axios = require('axios');
const pMap = require('p-map');

const rawSources = [
    // مصادر APIs تتحدث تلقائياً بالثواني
    'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=ipport&format=text',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
    'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
    'https://raw.githubusercontent.com/B4RC0DE-TM/proxy-list/main/HTTP.txt',
    'https://raw.githubusercontent.com/hendrikbgr/Free-Proxy-Repo/master/proxy_list.txt',
    'https://raw.githubusercontent.com/Anonym0usWork1221/Free-Proxies/main/proxy_files/http_proxies.txt'
];

async function harvestAll() {
    let all = [];
    console.log(`⏳ بدأ جلب البروكسيات المتجددة...`);

    await pMap(rawSources, async (url) => {
        try {
            const { data } = await axios.get(url, { timeout: 15000 });
            
            const regex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{1,5})/g;
            let match;
            
            while ((match = regex.exec(data)) !== null) {
                const port = parseInt(match[2]); 
                if (port > 0 && port <= 65535) {
                    all.push({ ip: match[1], port: port, protocol: 'http' });
                }
            }
        } catch (e) {
            // تجاهل المصادر المعطلة
        }
    }, { concurrency: 8 });

    const unique = Array.from(new Map(all.map(p => [`${p.ip}:${p.port}`, p])).values());
    console.log(`✅ انتهى الفحص: تم العثور على ${unique.length} بروكسي فريد.`);
    return unique;
}

module.exports = { harvestAll };
