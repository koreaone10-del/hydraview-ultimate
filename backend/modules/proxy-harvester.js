const axios = require('axios');
const pMap = require('p-map');

const rawSources = [
    'https://free-proxy-list.net/', // 👈 تم إضافة الموقع المطلوب هنا
    'https://api.proxyscrape.com/v3/free-proxy-list/get?request=displayproxies&protocol=http,socks4,socks5&proxy_format=ipport&format=text&timeout=10000',
    'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc',
    'https://www.proxy-list.download/api/v1/get?type=http',
    'https://spys.me/proxy.txt',
    'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
    'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks4/data.txt',
    'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
    'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/http.txt',
    'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
    'https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt'
];

async function harvestAll() {
    let all = [];
    console.log(`⏳ بدأ جلب البروكسيات من المصادر الحية...`);

    await pMap(rawSources, async (url) => {
        try {
            const { data } = await axios.get(url, { timeout: 15000 });
            
            // قناص الأرقام: يستخرج الـ IP والـ Port من أي صفحة سواء كانت Text أو HTML أو JSON
            const regex = /"?(?:ip|host)"?\s*:\s*"([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})"|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{1,5})|<td>([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})<\/td><td>([0-9]{1,5})<\/td>/g;
            let match;
            
            while ((match = regex.exec(data)) !== null) {
                const ip = match[1] || match[2] || match[4];
                const port = parseInt(match[3] || match[5] || 0); 
                if (port > 0 && port <= 65535) {
                    all.push({ ip: ip, port: port, protocol: 'http' });
                }
            }
        } catch (e) {
            // تجاهل المصادر المعطلة
        }
    }, { concurrency: 10 });

    const unique = Array.from(new Map(all.map(p => [`${p.ip}:${p.port}`, p])).values());
    console.log(`✅ انتهى الفحص: تم العثور على ${unique.length} بروكسي فريد.`);
    return unique;
}

module.exports = { harvestAll };
