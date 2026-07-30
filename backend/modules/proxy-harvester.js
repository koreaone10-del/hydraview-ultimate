const axios = require('axios');
const cheerio = require('cheerio');
const pMap = require('p-map');

// قائمة المصادر - يمكن إضافة مئات منها (هذه أمثلة فقط للاختصار، لكن سنضيف أكثر لاحقاً)
const sources = [
    // APIs نصية
    { type: 'text', url: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all' },
    { type: 'text', url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks4.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/socks5.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-https.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks4.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-socks5.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS5.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/roosterkid/openproxylist/main/SOCKS4.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt' },
    { type: 'text', url: 'https://raw.githubusercontent.com/hookzof/socks5_list/master/twitter.txt' },
    // ... أضف ما شئت من مستودعات GitHub بصيغة raw
];

// يمكن إضافة وظيفة لتحميل قوائم من صفحات HTML معروفة
const htmlSources = [
    'https://free-proxy-list.net/',
    'https://www.sslproxies.org/',
    'https://www.us-proxy.org/',
    'https://www.socks-proxy.net/',
    'https://hidemy.name/en/proxy-list/',
    // ...
];

async function harvestAll() {
    let all = [];
    // معالجة المصادر النصية
    await pMap(sources, async (src) => {
        try {
            const { data } = await axios.get(src.url, { timeout: 15000 });
            const lines = data.split('\n').filter(line => line && !line.startsWith('#') && line.includes(':'));
            lines.forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    all.push({ ip: parts[0], port: parseInt(parts[1]), protocol: 'http' });
                }
            });
        } catch {}
    }, { concurrency: 10 });

    // معالجة مصادر HTML
    await pMap(htmlSources, async (url) => {
        try {
            const { data } = await axios.get(url, { timeout: 15000 });
            const $ = cheerio.load(data);
            $('table tbody tr').each((i, row) => {
                const cols = $(row).find('td');
                if (cols.length >= 2) {
                    const ip = $(cols[0]).text().trim();
                    const port = $(cols[1]).text().trim();
                    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                        all.push({ ip, port: parseInt(port), protocol: 'http' });
                    }
                }
            });
        } catch {}
    }, { concurrency: 5 });

    // إزالة التكرارات
    const unique = Array.from(new Map(all.map(p => [`${p.ip}:${p.port}`, p])).values());
    return unique;
}

module.exports = { harvestAll };